import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { CronJob } from "cron";
import { Repository } from "typeorm";
import type { GenerationStatus, JobKind } from "@naija-brief/shared";
import { BriefService } from "../brief/brief.service";
import { todayKey } from "../brief/date.util";
import { GenerationJobEntity } from "../entities/generation-job.entity";

const SAFETY_INTERVAL_MS = 30_000; // picks up backoff-delayed retries
const SHUTDOWN_GRACE_MS = 5_000; // how long to let an in-flight job finish
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 300_000;
const MAX_ATTEMPTS: Record<JobKind, number> = { generate: 3, tts: 5 };

/** Postgres error code for a unique-constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return e?.code === "23505" || e?.driverError?.code === "23505";
}

/**
 * A durable, in-process job runner backed by Postgres — no Redis, no extra
 * infrastructure. It is deliberately event-driven (an enqueue kicks the worker)
 * with a single slow safety interval for delayed retries, so it adds negligible
 * DB load. One job runs at a time (single-flight via an in-memory flag), which
 * for a single instance is a global guarantee.
 */
@Injectable()
export class JobsService
  implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(JobsService.name);
  private running = false;
  private pending = false;
  private shuttingDown = false;
  private current: Promise<void> | null = null;
  private loopPromise: Promise<void> = Promise.resolve();
  private safetyTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(GenerationJobEntity)
    private readonly jobs: Repository<GenerationJobEntity>,
    private readonly brief: BriefService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  // Register the daily cron here (not via @Cron) so BRIEF_CRON is read after
  // ConfigModule has loaded .env. The tick only *enqueues* — the worker runs it.
  onModuleInit(): void {
    const expr = this.config.get<string>("BRIEF_CRON") || "0 6 * * *";
    try {
      const job = CronJob.from({
        cronTime: expr,
        onTick: () => {
          this.logger.log("Daily cron fired");
          // enqueue rethrows non-unique DB errors; the tick discards the promise,
          // so catch here or a DB blip at cron time becomes an unhandled rejection.
          void this.enqueue("generate", todayKey()).catch((err) => {
            const m = err instanceof Error ? err.message : String(err);
            this.logger.error(`cron enqueue failed: ${m}`);
          });
        },
        timeZone: "Africa/Lagos",
        start: true,
      });
      this.scheduler.addCronJob("daily-brief", job as never);
      this.logger.log(`Daily brief scheduled: "${expr}" Africa/Lagos`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Invalid BRIEF_CRON "${expr}" — daily brief not scheduled: ${message}`,
      );
    }

    // The only periodic timer: a slow sweep so time-delayed retries get picked
    // up even with no new enqueue. unref() so it never keeps the process alive.
    this.safetyTimer = setInterval(() => this.kick(), SAFETY_INTERVAL_MS);
    this.safetyTimer.unref();
  }

  // Runs after TypeORM is connected: recover jobs a crash left mid-flight, then
  // start draining the queue.
  async onApplicationBootstrap(): Promise<void> {
    await this.recoverInterrupted();
    this.kick();
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.safetyTimer) clearInterval(this.safetyTimer);
    try {
      this.scheduler.getCronJob("daily-brief").stop();
    } catch {
      // Never registered (invalid cron) — nothing to stop.
    }
    // Give the in-flight job a bounded moment to finish; if the process is
    // killed first, its row stays 'running' and boot recovery requeues it.
    if (this.current) {
      await Promise.race([this.current, this.delay(SHUTDOWN_GRACE_MS)]);
    }
  }

  /**
   * Insert a queued job and kick the worker. The partial unique index makes this
   * idempotent: a second active job for the same (kind, date) is silently
   * skipped, so the cron and a manual regenerate can't double up.
   */
  async enqueue(kind: JobKind, date: string): Promise<void> {
    try {
      await this.jobs.insert({
        kind,
        date,
        status: "queued",
        maxAttempts: MAX_ATTEMPTS[kind],
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        this.logger.log(`${kind} job for ${date} already active — skipping`);
        return;
      }
      throw err;
    }
    this.kick();
  }

  /** Map the latest generate job onto the UI-facing status shape. */
  async getStatus(): Promise<GenerationStatus> {
    const job = await this.jobs.findOne({
      where: { kind: "generate" },
      order: { createdAt: "DESC" },
    });
    if (!job) return { status: "idle", step: "", error: "", startedAt: null };
    const startedAt = (job.startedAt ?? job.createdAt).toISOString();
    switch (job.status) {
      case "queued":
      case "running":
        return { status: "running", step: job.step, error: "", startedAt };
      case "succeeded":
        return {
          status: "done",
          step: job.step || "Brief ready",
          error: "",
          startedAt,
        };
      case "failed":
        return { status: "error", step: job.step, error: job.error ?? "", startedAt };
    }
    return { status: "idle", step: "", error: "", startedAt: null };
  }

  // --- worker internals -------------------------------------------------

  // Signal that there may be work and ensure the drain loop is running. Setting
  // `pending` before the running check closes the lost-wakeup window: a job
  // enqueued just as the loop is finishing is still observed by the outer while.
  private kick(): void {
    this.pending = true;
    if (this.running) return; // the active loop will observe `pending`
    this.loopPromise = this.runLoop().catch((err) => {
      const m = err instanceof Error ? err.message : String(err);
      this.logger.error(`job loop crashed: ${m}`);
    });
  }

  private async runLoop(): Promise<void> {
    if (this.running || this.shuttingDown) return;
    this.running = true;
    try {
      while (this.pending && !this.shuttingDown) {
        // Consume the signal before claiming, so an enqueue during this drain
        // re-sets it and triggers another pass rather than being lost.
        this.pending = false;
        for (;;) {
          if (this.shuttingDown) break;
          const job = await this.claimNext();
          if (!job) break;
          this.current = this.process(job);
          await this.current;
          this.current = null;
        }
      }
    } finally {
      this.running = false;
      this.current = null;
    }
  }

  private async claimNext(): Promise<GenerationJobEntity | null> {
    const now = new Date();
    // Single instance: the in-memory `running` flag serializes claims, so it is
    // safe to read the (small) set of queued jobs and pick one in JS. For
    // multiple worker processes this is where a transactional
    // `SELECT ... FOR UPDATE SKIP LOCKED` claim would go instead.
    const queued = await this.jobs.find({ where: { status: "queued" } });
    const ready = queued
      .filter((j) => !j.nextRunAt || j.nextRunAt.getTime() <= now.getTime())
      .sort((a, b) => {
        // Fresh jobs (no backoff, nextRunAt null → 0) first, then oldest-created.
        const an = a.nextRunAt?.getTime() ?? 0;
        const bn = b.nextRunAt?.getTime() ?? 0;
        if (an !== bn) return an - bn;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
    const job = ready[0];
    if (!job) return null;

    job.status = "running";
    job.startedAt = now;
    job.attempts += 1;
    await this.jobs.save(job);
    return job;
  }

  private async process(job: GenerationJobEntity): Promise<void> {
    try {
      const report = (step: string) => this.reportStep(job, step);
      if (job.kind === "generate") {
        // Use the date the brief was actually SAVED under, not job.date: a job
        // deferred across midnight (backoff retry, queue delay, crash recovery)
        // runs generateText on a later Lagos day, so job.date would point the
        // tts job at a date with no brief and orphan the audio.
        const { date } = await this.brief.generateText(report);
        // Chain the audio step as its own retryable job before marking done, so
        // a crash between the two can't drop it (recovery re-runs generate,
        // which re-enqueues tts — deduped by the unique index).
        await this.enqueue("tts", date);
        await this.markSucceeded(job);
      } else {
        await this.brief.synthesizeForDate(job.date, report);
        await this.markSucceeded(job);
      }
    } catch (err) {
      try {
        await this.handleFailure(job, err);
      } catch (recordErr) {
        const m = recordErr instanceof Error ? recordErr.message : String(recordErr);
        this.logger.error(`could not record failure for job ${job.id}: ${m}`);
      }
    }
  }

  private reportStep(job: GenerationJobEntity, step: string): void {
    job.step = step;
    this.logger.log(`[${job.kind}] ${step}`);
    // Best-effort progress persistence — never let it break the pipeline.
    void this.jobs.update(job.id, { step }).catch(() => {});
  }

  private async markSucceeded(job: GenerationJobEntity): Promise<void> {
    await this.jobs.update(job.id, {
      status: "succeeded",
      finishedAt: new Date(),
      error: null,
    });
  }

  private async handleFailure(
    job: GenerationJobEntity,
    err: unknown,
  ): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    if (job.attempts >= job.maxAttempts) {
      this.logger.error(
        `[${job.kind}] job ${job.id} failed permanently after ${job.attempts} attempts: ${message}`,
      );
      await this.jobs.update(job.id, {
        status: "failed",
        finishedAt: new Date(),
        error: message,
      });
      // A permanently-failed voicing must be recorded on the brief itself, so
      // the UI says "the voiceover couldn't be generated" rather than showing
      // the intentional no-audio message. (The text brief already exists.)
      if (job.kind === "tts") {
        await this.brief.recordAudioError(job.date, message).catch((e) => {
          const m = e instanceof Error ? e.message : String(e);
          this.logger.error(`could not record audio error for ${job.date}: ${m}`);
        });
      }
      return;
    }
    const delay = this.backoff(job.attempts);
    const nextRunAt = new Date(Date.now() + delay);
    this.logger.warn(
      `[${job.kind}] job ${job.id} attempt ${job.attempts} failed: ${message} — retrying in ${Math.round(delay / 1000)}s`,
    );
    await this.jobs.update(job.id, { status: "queued", nextRunAt, error: message });
  }

  private backoff(attempts: number): number {
    const exp = Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
    return exp + Math.floor(Math.random() * 1000); // jitter
  }

  private async recoverInterrupted(): Promise<void> {
    const stuck = await this.jobs.find({ where: { status: "running" } });
    for (const job of stuck) {
      if (job.attempts >= job.maxAttempts) {
        await this.jobs.update(job.id, {
          status: "failed",
          finishedAt: new Date(),
          error: "interrupted by shutdown/crash; no attempts left",
        });
      } else {
        // Requeue WITHOUT re-incrementing — the crashed attempt already counted.
        await this.jobs.update(job.id, {
          status: "queued",
          startedAt: null,
          nextRunAt: null,
        });
      }
    }
    if (stuck.length) {
      this.logger.warn(`recovered ${stuck.length} interrupted job(s)`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      t.unref();
    });
  }
}
