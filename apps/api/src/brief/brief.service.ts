import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { CronJob } from "cron";
import type { AudioMarker, Brief, GenerationStatus } from "@naija-brief/shared";
import { NewsService } from "../news/news.service";
import {
  SummarizeService,
  type SummarizedSection,
} from "../summarize/summarize.service";
import { TtsService, type BriefSegment } from "../tts/tts.service";
import { BriefStore } from "./brief-store.service";
import { formatDateLabel, todayKey } from "./date.util";

@Injectable()
export class BriefService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BriefService.name);
  private job: GenerationStatus = {
    status: "idle",
    step: "",
    error: "",
    startedAt: null,
  };

  constructor(
    private readonly news: NewsService,
    private readonly summarize: SummarizeService,
    private readonly tts: TtsService,
    private readonly store: BriefStore,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  // The cron expression is registered here — not via the @Cron decorator —
  // because decorator arguments are evaluated at import time, before
  // ConfigModule has loaded .env, which would silently ignore BRIEF_CRON.
  onModuleInit(): void {
    const expr = this.config.get<string>("BRIEF_CRON") || "0 6 * * *";
    try {
      const job = CronJob.from({
        cronTime: expr,
        onTick: () => {
          this.logger.log("Daily cron fired");
          this.startGeneration();
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
  }

  // Stop the timer on shutdown so it doesn't leak (e.g. in tests).
  onModuleDestroy(): void {
    try {
      this.scheduler.getCronJob("daily-brief").stop();
    } catch {
      // Job was never registered (invalid cron) — nothing to stop.
    }
  }

  getStatus(): GenerationStatus {
    return { ...this.job };
  }

  /** Kicks off a generation if one isn't already running. Returns false if busy. */
  startGeneration(): boolean {
    if (this.job.status === "running") return false;
    this.job = {
      status: "running",
      step: "Starting",
      error: "",
      startedAt: new Date().toISOString(),
    };
    void this.runGeneration();
    return true;
  }

  private async runGeneration(): Promise<void> {
    try {
      await this.generateBrief((step) => {
        this.job.step = step;
        this.logger.log(step);
      });
      this.job.status = "done";
      this.job.step = "Brief ready";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`generation failed: ${message}`);
      this.job.status = "error";
      this.job.error = message;
    }
  }

  /**
   * Full pipeline: fetch feeds -> summarize per section (isolated) -> intro/outro
   * -> synthesize audio (failure-tolerant) -> persist.
   */
  async generateBrief(onProgress: (step: string) => void = () => {}): Promise<Brief> {
    const date = todayKey();
    const dateLabel = formatDateLabel();

    onProgress("Fetching headlines from Nigerian and world feeds");
    const { sections: rawSections, failures } =
      await this.news.fetchAllSections();
    const total = rawSections.reduce((n, s) => n + s.stories.length, 0);
    if (total === 0) {
      throw new Error(
        "No stories could be fetched from any feed. Check your internet connection.",
      );
    }

    onProgress(
      `Summarizing ${total} stories across ${rawSections.length} sections`,
    );
    const sectionsFailed: { section: string; error: string }[] = [];
    const summarized: SummarizedSection[] = await Promise.all(
      rawSections.map(async (section) => {
        try {
          return await this.summarize.summarizeSection(section);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`section "${section.id}" failed: ${message}`);
          sectionsFailed.push({ section: section.title, error: message });
          return {
            id: section.id,
            title: section.title,
            script: "",
            stories: [],
          };
        }
      }),
    );

    onProgress("Writing the intro and sign-off");
    let intro = "";
    let outro = "";
    try {
      ({ intro, outro } = await this.summarize.writeIntroOutro(
        dateLabel,
        summarized,
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`intro/outro failed: ${message}`);
      intro = `Good morning. It's ${dateLabel}. Here is your Naija Brief.`;
      outro = "That's your briefing. Have a great day.";
    }

    const sections = summarized.filter((s) => s.stories.length || s.script);
    if (sections.length === 0) {
      throw new Error(
        "Every section failed to summarize. Check your OpenRouter key and model.",
      );
    }

    let audio: { durationSec: number; markers: AudioMarker[] } | null = null;
    let audioBuffer: Buffer | null = null;
    let audioError: string | null = null;

    if (!this.tts.skip) {
      try {
        const segments: BriefSegment[] = [
          { id: "intro", text: intro },
          ...sections.map((s) => ({ id: s.id, text: s.script })),
          { id: "outro", text: outro },
        ];
        const result = await this.tts.synthesize(segments, onProgress);
        audioBuffer = result.wav;
        audio = {
          durationSec: Math.round(result.durationSec),
          markers: result.markers,
        };
      } catch (err) {
        // The LLM work is done and paid for — keep the text brief even if the
        // voice step fails. The UI already handles an audio-less brief.
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`TTS failed: ${message}`);
        audioError = message;
      }
    }

    await this.store.save({
      date,
      dateLabel,
      generatedAt: new Date(),
      intro,
      outro,
      sections,
      sourcesFailed: failures,
      sectionsFailed,
      audio,
      audioBuffer,
      audioError,
    });

    onProgress("Brief ready");
    const saved = await this.store.findByDate(date);
    if (!saved) throw new Error("Brief was generated but could not be reloaded.");
    return saved;
  }
}
