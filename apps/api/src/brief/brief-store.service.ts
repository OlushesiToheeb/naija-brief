import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { AudioMarker, Brief } from "@naija-brief/shared";
import { BriefEntity } from "../entities/brief.entity";
import { SectionEntity } from "../entities/section.entity";
import { StoryEntity } from "../entities/story.entity";
import { todayKey } from "./date.util";

export interface BriefInput {
  date: string;
  dateLabel: string;
  generatedAt: Date;
  intro: string;
  outro: string;
  sections: {
    id: string;
    title: string;
    script: string;
    stories: {
      id: string;
      headline: string;
      summary: string;
      source: string;
      link: string;
      publishedAt: string | null;
      content: string;
    }[];
  }[];
  sourcesFailed: { source: string; error: string }[];
  sectionsFailed: { section: string; error: string }[];
  audio: { durationSec: number; markers: AudioMarker[] } | null;
  audioBuffer: Buffer | null;
  audioError: string | null;
}

@Injectable()
export class BriefStore {
  constructor(
    @InjectRepository(BriefEntity)
    private readonly briefs: Repository<BriefEntity>,
  ) {}

  /**
   * Insert or replace the brief for a given date (one brief per day). The
   * delete + insert run in one transaction so a failed insert can never leave
   * the day without a brief, and concurrent writers for the same date serialize
   * on the unique index instead of racing the existence check.
   */
  async save(input: BriefInput): Promise<void> {
    const brief = new BriefEntity();
    brief.date = input.date;
    brief.dateLabel = input.dateLabel;
    brief.generatedAt = input.generatedAt;
    brief.intro = input.intro;
    brief.outro = input.outro;
    brief.sourcesFailed = input.sourcesFailed;
    brief.sectionsFailed = input.sectionsFailed;
    brief.audioError = input.audioError;
    brief.audioDurationSec = input.audio ? input.audio.durationSec : null;
    brief.audioMarkers = input.audio ? input.audio.markers : null;
    brief.audioMime = input.audioBuffer ? "audio/wav" : null;
    brief.audioData = input.audioBuffer;

    brief.sections = input.sections.map((s, si) => {
      const section = new SectionEntity();
      section.sectionKey = s.id;
      section.title = s.title;
      section.script = s.script;
      section.position = si;
      section.stories = s.stories.map((st, sti) => {
        const story = new StoryEntity();
        story.storyKey = st.id;
        story.headline = st.headline;
        story.summary = st.summary;
        story.source = st.source;
        story.link = st.link;
        story.publishedAt = st.publishedAt ? new Date(st.publishedAt) : null;
        story.content = st.content;
        story.position = sti;
        return story;
      });
      return section;
    });

    await this.briefs.manager.transaction(async (em) => {
      const existing = await em.findOne(BriefEntity, {
        where: { date: input.date },
        select: { id: true },
        loadEagerRelations: false,
      });
      if (existing) await em.delete(BriefEntity, { id: existing.id });
      await em.save(brief);
    });
  }

  private toDto(entity: BriefEntity): Brief {
    const sections = [...entity.sections]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        id: s.sectionKey,
        title: s.title,
        script: s.script,
        stories: [...s.stories]
          .sort((a, b) => a.position - b.position)
          .map((st) => ({
            id: st.storyKey,
            headline: st.headline,
            summary: st.summary,
            source: st.source,
            link: st.link,
            publishedAt: st.publishedAt ? st.publishedAt.toISOString() : null,
            content: st.content,
          })),
      }));

    return {
      date: entity.date,
      dateLabel: entity.dateLabel,
      generatedAt: entity.generatedAt.toISOString(),
      intro: entity.intro,
      outro: entity.outro,
      sections,
      audio:
        entity.audioDurationSec != null
          ? {
              durationSec: entity.audioDurationSec,
              markers: entity.audioMarkers ?? [],
            }
          : null,
      audioError: entity.audioError,
      sourcesFailed: entity.sourcesFailed ?? [],
      sectionsFailed: entity.sectionsFailed ?? [],
      isToday: entity.date === todayKey(),
    };
  }

  async findByDate(date: string): Promise<Brief | null> {
    const entity = await this.briefs.findOne({ where: { date } });
    return entity ? this.toDto(entity) : null;
  }

  /** The most recent brief, or null if none exist. */
  async findLatest(): Promise<Brief | null> {
    const entity = await this.briefs.findOne({
      where: {},
      order: { date: "DESC" },
    });
    return entity ? this.toDto(entity) : null;
  }

  async listDates(): Promise<string[]> {
    const rows = await this.briefs.find({
      select: { date: true },
      order: { date: "DESC" },
      // Don't drag in the whole section/story tree just to list dates.
      loadEagerRelations: false,
    });
    return rows.map((r) => r.date);
  }

  /** The raw WAV bytes for a date, or null. audioData is select:false, so ask for it. */
  async findAudio(date: string): Promise<Buffer | null> {
    const row = await this.briefs.findOne({
      where: { date },
      select: { id: true, audioData: true },
      // Keep this to the audio blob only — skip the eager section/story joins.
      loadEagerRelations: false,
    });
    return row?.audioData ?? null;
  }
}
