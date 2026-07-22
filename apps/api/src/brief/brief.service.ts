import { Injectable, Logger } from "@nestjs/common";
import type { Brief } from "@naija-brief/shared";
import { NewsService } from "../news/news.service";
import {
  SummarizeService,
  type SummarizedSection,
} from "../summarize/summarize.service";
import { TtsService, type BriefSegment } from "../tts/tts.service";
import { BriefStore } from "./brief-store.service";
import { formatDateLabel, todayKey } from "./date.util";

// The generation pipeline. It is split into two independently-runnable halves so
// the durable job queue can retry the expensive-to-lose audio step on its own:
//   generateText()      → fetch + summarize + save the TEXT brief (no audio)
//   synthesizeForDate()  → voice that brief and attach the audio
// A TTS failure therefore never re-pays for the LLM work. Scheduling, status and
// retries live in JobsService; this class is stateless pipeline logic.
@Injectable()
export class BriefService {
  private readonly logger = new Logger(BriefService.name);

  constructor(
    private readonly news: NewsService,
    private readonly summarize: SummarizeService,
    private readonly tts: TtsService,
    private readonly store: BriefStore,
  ) {}

  /**
   * Fetch feeds → summarize per section (isolated) → intro/outro → persist the
   * text brief with no audio yet. Returns the date so a follow-on TTS job can
   * find it. Throws only on total failure (no stories, or every section failed).
   */
  async generateText(
    onProgress: (step: string) => void = () => {},
  ): Promise<{ date: string }> {
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
          return { id: section.id, title: section.title, script: "", stories: [] };
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

    await this.store.save({
      date,
      dateLabel,
      generatedAt: new Date(),
      intro,
      outro,
      sections,
      sourcesFailed: failures,
      sectionsFailed,
      // Audio is attached later by a separate TTS job.
      audio: null,
      audioBuffer: null,
      audioMime: null,
      audioError: null,
    });

    onProgress("Brief text ready");
    return { date };
  }

  /**
   * Voice an already-saved text brief and attach the audio via a targeted
   * update. Throws on synthesis failure so the caller (the TTS job) can retry
   * without touching the text. When TTS is disabled, records "no audio".
   */
  async synthesizeForDate(
    date: string,
    onProgress: (step: string) => void = () => {},
  ): Promise<void> {
    const brief = await this.store.findByDate(date);
    if (!brief) {
      throw new Error(`No brief for ${date} to synthesize audio for.`);
    }

    if (this.tts.skip) {
      await this.store.updateAudio(date, {
        buffer: null,
        mime: null,
        durationSec: null,
        markers: null,
        error: null,
      });
      return;
    }

    const segments: BriefSegment[] = [
      { id: "intro", text: brief.intro },
      ...brief.sections.map((s) => ({ id: s.id, text: s.script })),
      { id: "outro", text: brief.outro },
    ];

    const result = await this.tts.synthesize(segments, onProgress);
    await this.store.updateAudio(date, {
      buffer: result.audio,
      mime: result.mime,
      durationSec: Math.round(result.durationSec),
      markers: result.markers,
      error: null,
    });
    onProgress("Audio ready");
  }

  /**
   * Record that voicing permanently failed on an already-saved brief, so the UI
   * can distinguish "the voiceover failed" from an intentional no-audio brief.
   */
  async recordAudioError(date: string, message: string): Promise<void> {
    await this.store.updateAudio(date, {
      buffer: null,
      mime: null,
      durationSec: null,
      markers: null,
      error: message,
    });
  }

  /**
   * The whole pipeline in one call: text then audio. Unlike the job flow, a TTS
   * failure here is swallowed (recorded as audioError) so the text brief still
   * lands — used by tests and any direct, non-queued caller.
   */
  async generateBrief(
    onProgress: (step: string) => void = () => {},
  ): Promise<Brief> {
    const { date } = await this.generateText(onProgress);
    try {
      await this.synthesizeForDate(date, onProgress);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`TTS failed: ${message}`);
      await this.store.updateAudio(date, {
        buffer: null,
        mime: null,
        durationSec: null,
        markers: null,
        error: message,
      });
    }

    onProgress("Brief ready");
    const saved = await this.store.findByDate(date);
    if (!saved) throw new Error("Brief was generated but could not be reloaded.");
    return saved;
  }
}
