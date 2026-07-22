import { JobsService } from "./jobs.service";
import { GenerationJobEntity } from "../entities/generation-job.entity";
import type { BriefService } from "../brief/brief.service";
import type { ConfigService } from "@nestjs/config";
import type { SchedulerRegistry } from "@nestjs/schedule";
import type { Repository } from "typeorm";

// A tiny in-memory stand-in for the TypeORM repository, supporting just the
// methods JobsService uses — and enforcing the (kind, date) active-job unique
// index so the dedup path can be exercised.
class FakeRepo {
  rows: GenerationJobEntity[] = [];
  private seq = 0;

  insert(entity: Partial<GenerationJobEntity>): Promise<void> {
    const active = this.rows.some(
      (r) =>
        r.kind === entity.kind &&
        r.date === entity.date &&
        (r.status === "queued" || r.status === "running"),
    );
    if (active) {
      const err = new Error("duplicate key") as Error & { code: string };
      err.code = "23505";
      return Promise.reject(err);
    }
    this.seq += 1;
    this.rows.push({
      id: `job-${this.seq}`,
      kind: entity.kind!,
      status: entity.status ?? "queued",
      date: entity.date!,
      step: entity.step ?? "",
      error: entity.error ?? null,
      attempts: entity.attempts ?? 0,
      maxAttempts: entity.maxAttempts ?? 3,
      nextRunAt: entity.nextRunAt ?? null,
      createdAt: new Date(Date.now() + this.seq), // monotonic for ordering
      startedAt: entity.startedAt ?? null,
      finishedAt: entity.finishedAt ?? null,
    });
    return Promise.resolve();
  }

  // Return DETACHED copies, like real TypeORM — so mutating a returned row does
  // not silently alter stored state, and claimNext's save()/update() are what
  // actually persist changes (otherwise dropping save() would still pass).
  find(opts: { where: Partial<GenerationJobEntity> }): Promise<GenerationJobEntity[]> {
    return Promise.resolve(
      this.rows.filter((r) => matches(r, opts.where)).map((r) => ({ ...r })),
    );
  }

  findOne(opts: {
    where: Partial<GenerationJobEntity>;
    order?: { createdAt?: "ASC" | "DESC" };
  }): Promise<GenerationJobEntity | null> {
    let matched = this.rows.filter((r) => matches(r, opts.where));
    if (opts.order?.createdAt) {
      matched = [...matched].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      if (opts.order.createdAt === "DESC") matched.reverse();
    }
    return Promise.resolve(matched[0] ? { ...matched[0] } : null);
  }

  save(entity: GenerationJobEntity): Promise<GenerationJobEntity> {
    const i = this.rows.findIndex((r) => r.id === entity.id);
    if (i >= 0) this.rows[i] = entity;
    else this.rows.push(entity);
    return Promise.resolve(entity);
  }

  update(id: string, partial: Partial<GenerationJobEntity>): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) Object.assign(row, partial);
    return Promise.resolve();
  }
}

function matches(
  row: GenerationJobEntity,
  where: Partial<GenerationJobEntity>,
): boolean {
  return Object.entries(where).every(
    ([k, v]) => row[k as keyof GenerationJobEntity] === v,
  );
}

function makeService() {
  const repo = new FakeRepo();
  const brief = {
    generateText: jest.fn().mockResolvedValue({ date: "2026-07-22" }),
    synthesizeForDate: jest.fn().mockResolvedValue(undefined),
    recordAudioError: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<BriefService>;
  const config = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;
  const scheduler = {
    addCronJob: jest.fn(),
    getCronJob: jest.fn(),
  } as unknown as SchedulerRegistry;
  const service = new JobsService(
    repo as unknown as Repository<GenerationJobEntity>,
    brief,
    config,
    scheduler,
  );
  return { service, repo, brief };
}

// Start the worker loop (if idle) and await a full drain. `loopPromise` always
// points at the active loop, and nested enqueues run under it, so awaiting it
// awaits the whole chain — no timers, fully deterministic.
function drain(service: JobsService): Promise<void> {
  (service as unknown as { kick(): void }).kick();
  return (service as unknown as { loopPromise: Promise<void> }).loopPromise;
}

function recover(service: JobsService): Promise<void> {
  return (service as unknown as { recoverInterrupted(): Promise<void> }).recoverInterrupted();
}

describe("JobsService worker", () => {
  it("runs a generate job, chains a tts job, and marks both succeeded", async () => {
    const { service, repo, brief } = makeService();
    await service.enqueue("generate", "2026-07-22");
    await drain(service);

    expect(brief.generateText).toHaveBeenCalledTimes(1);
    expect(brief.synthesizeForDate).toHaveBeenCalledWith(
      "2026-07-22",
      expect.any(Function),
    );
    expect(repo.rows.map((r) => `${r.kind}:${r.status}`)).toEqual([
      "generate:succeeded",
      "tts:succeeded",
    ]);
  });

  it("chains the tts job for the date the brief was saved under, not the enqueue date", async () => {
    const { service, repo, brief } = makeService();
    // The brief is saved under today's Lagos date...
    (brief.generateText as jest.Mock).mockResolvedValue({ date: "2026-07-22" });
    // ...but the generate job was enqueued yesterday (deferred across midnight).
    await repo.insert({
      kind: "generate",
      date: "2026-07-21",
      status: "queued",
      maxAttempts: 3,
    });
    await drain(service);

    const tts = repo.rows.find((r) => r.kind === "tts");
    expect(tts?.date).toBe("2026-07-22"); // follows the saved brief, not job.date
  });

  it("skips enqueue when an active job for the same kind and date exists", async () => {
    const { service, repo } = makeService();
    await repo.insert({
      kind: "generate",
      date: "2026-07-22",
      status: "running",
      maxAttempts: 3,
    });
    await service.enqueue("generate", "2026-07-22");
    expect(repo.rows.filter((r) => r.kind === "generate")).toHaveLength(1);
  });

  it("fails a job permanently once attempts reach maxAttempts", async () => {
    const { service, repo, brief } = makeService();
    brief.synthesizeForDate.mockRejectedValue(new Error("kokoro boom"));
    await repo.insert({
      kind: "tts",
      date: "2026-07-22",
      status: "queued",
      maxAttempts: 1,
    });
    await drain(service);

    const job = repo.rows.find((r) => r.kind === "tts")!;
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(1);
    expect(job.error).toMatch(/kokoro boom/);
    expect(job.finishedAt).toBeInstanceOf(Date);
    // A permanently-failed voicing is recorded on the brief so the UI can say so.
    expect(brief.recordAudioError).toHaveBeenCalledWith(
      "2026-07-22",
      expect.stringMatching(/kokoro boom/),
    );
  });

  it("requeues with backoff when a job fails but has attempts left", async () => {
    const { service, repo, brief } = makeService();
    brief.synthesizeForDate.mockRejectedValue(new Error("transient"));
    await repo.insert({
      kind: "tts",
      date: "2026-07-22",
      status: "queued",
      maxAttempts: 3,
    });
    await drain(service);

    const job = repo.rows.find((r) => r.kind === "tts")!;
    expect(job.status).toBe("queued");
    expect(job.attempts).toBe(1);
    expect(job.nextRunAt).toBeInstanceOf(Date);
    expect(job.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    expect(job.error).toMatch(/transient/);
  });

  it("processes jobs one at a time (single-flight)", async () => {
    const { service, repo, brief } = makeService();
    let active = 0;
    let maxActive = 0;
    brief.generateText.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return { date: "x" };
    });
    await repo.insert({ kind: "generate", date: "2026-07-01", status: "queued", maxAttempts: 3 });
    await repo.insert({ kind: "generate", date: "2026-07-02", status: "queued", maxAttempts: 3 });
    await drain(service);

    expect(maxActive).toBe(1);
    expect(repo.rows.filter((r) => r.kind === "generate" && r.status === "succeeded")).toHaveLength(2);
  });
});

describe("JobsService.recoverInterrupted", () => {
  it("requeues an interrupted job with attempts left and fails an exhausted one", async () => {
    const { service, repo } = makeService();
    await repo.insert({
      kind: "generate",
      date: "d1",
      status: "running",
      attempts: 1,
      maxAttempts: 3,
      startedAt: new Date(),
    });
    await repo.insert({
      kind: "tts",
      date: "d2",
      status: "running",
      attempts: 3,
      maxAttempts: 3,
      startedAt: new Date(),
    });

    await recover(service);

    const g = repo.rows.find((r) => r.date === "d1")!;
    const t = repo.rows.find((r) => r.date === "d2")!;
    expect(g.status).toBe("queued");
    expect(g.startedAt).toBeNull();
    expect(g.attempts).toBe(1); // NOT re-incremented — the crashed attempt counted
    expect(t.status).toBe("failed");
  });
});

describe("JobsService.getStatus", () => {
  it("returns idle when there is no generate job", async () => {
    const { service } = makeService();
    expect(await service.getStatus()).toEqual({
      status: "idle",
      step: "",
      error: "",
      startedAt: null,
    });
  });

  it("maps running and reports the step", async () => {
    const { service, repo } = makeService();
    await repo.insert({
      kind: "generate",
      date: "d",
      status: "running",
      step: "Summarizing",
      maxAttempts: 3,
      startedAt: new Date(),
    });
    expect(await service.getStatus()).toMatchObject({
      status: "running",
      step: "Summarizing",
    });
  });

  it("maps a succeeded job to done, with the 'Brief ready' step fallback", async () => {
    const { service, repo } = makeService();
    await repo.insert({
      kind: "generate",
      date: "d",
      status: "succeeded",
      step: "",
      maxAttempts: 3,
      startedAt: new Date(),
    });
    expect(await service.getStatus()).toMatchObject({
      status: "done",
      step: "Brief ready",
      error: "",
    });
  });

  it("maps the latest job — a failure surfaces as error", async () => {
    const { service, repo } = makeService();
    await repo.insert({ kind: "generate", date: "d1", status: "succeeded", maxAttempts: 3 });
    await repo.insert({
      kind: "generate",
      date: "d2",
      status: "failed",
      error: "nope",
      maxAttempts: 3,
    });
    expect(await service.getStatus()).toMatchObject({ status: "error", error: "nope" });
  });
});

describe("JobsService.enqueue error handling", () => {
  it("rethrows a non-unique insert error so the caller learns it was not enqueued", async () => {
    const { service, repo } = makeService();
    jest
      .spyOn(repo, "insert")
      .mockRejectedValueOnce(
        Object.assign(new Error("connection lost"), { code: "08006" }),
      );
    await expect(service.enqueue("generate", "d")).rejects.toThrow(/connection lost/);
  });

  it("treats a driverError-shaped 23505 as an active-job dedup (swallows it)", async () => {
    const { service, repo } = makeService();
    // Real TypeORM surfaces the pg code on driverError, not the top level.
    jest
      .spyOn(repo, "insert")
      .mockRejectedValueOnce(
        Object.assign(new Error("duplicate"), { driverError: { code: "23505" } }),
      );
    await expect(service.enqueue("tts", "d")).resolves.toBeUndefined();
  });
});
