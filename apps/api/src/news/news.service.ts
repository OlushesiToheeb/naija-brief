import { Injectable, Logger } from "@nestjs/common";
import Parser from "rss-parser";
import {
  MAX_ITEMS_PER_SECTION,
  MAX_STORY_AGE_HOURS,
  SECTIONS,
  type FeedSource,
  type SectionConfig,
} from "../config/sections";

export interface RawStory {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  content: string;
}

export interface FetchedSection extends SectionConfig {
  stories: RawStory[];
}

export interface FetchResult {
  sections: FetchedSection[];
  failures: { source: string; error: string }[];
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#8217;": "’",
  "&#8216;": "‘",
  "&#8220;": "“",
  "&#8221;": "”",
  "&#8211;": "–",
  "&#8212;": "—",
  "&nbsp;": " ",
};

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly parser = new Parser({
    timeout: 20_000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) NaijaBrief/1.0",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    customFields: { item: [["content:encoded", "contentEncoded"]] },
  });

  private stripHtml(html = ""): string {
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    for (const [entity, ch] of Object.entries(ENTITIES)) {
      text = text.split(entity).join(ch);
    }
    return text.replace(/&#\d+;|&\w+;/g, " ").replace(/\s+/g, " ").trim();
  }

  private normalizeTitle(t = ""): string {
    return t
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private toStory(item: Parser.Item & { contentEncoded?: string }, source: string): RawStory {
    const content = this.stripHtml(item.contentEncoded || item.content || "");
    return {
      title: (item.title || "").trim(),
      link: item.link || "",
      source,
      publishedAt: item.isoDate || null,
      content: content.slice(0, 2500),
    };
  }

  private async fetchFeed(feed: FeedSource): Promise<RawStory[]> {
    const parsed = await this.parser.parseURL(feed.url);
    return (parsed.items || [])
      .slice(0, 12)
      .map((i) => this.toStory(i, feed.source));
  }

  /**
   * Fetches every configured feed. Individual feed failures don't sink the
   * brief; they're recorded so the UI can say which sources were missing.
   */
  async fetchAllSections(): Promise<FetchResult> {
    const failures: { source: string; error: string }[] = [];
    const cutoff = Date.now() - MAX_STORY_AGE_HOURS * 3600 * 1000;

    const sections = await Promise.all(
      SECTIONS.map(async (section): Promise<FetchedSection> => {
        const results = await Promise.allSettled(
          section.feeds.map((feed) => this.fetchFeed(feed)),
        );

        const items: RawStory[] = [];
        results.forEach((result, i) => {
          const feed = section.feeds[i];
          if (result.status === "rejected") {
            const error = String(result.reason?.message ?? result.reason);
            failures.push({ source: feed.source, error });
            this.logger.warn(`${feed.source} failed: ${error}`);
            return;
          }
          items.push(...result.value);
        });

        const seen = new Set<string>();
        const fresh = items
          .filter((s) => s.title)
          .filter(
            (s) =>
              !s.publishedAt || new Date(s.publishedAt).getTime() >= cutoff,
          )
          .sort(
            (a, b) =>
              new Date(b.publishedAt || 0).getTime() -
              new Date(a.publishedAt || 0).getTime(),
          )
          .filter((s) => {
            const key = this.normalizeTitle(s.title);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, MAX_ITEMS_PER_SECTION);

        return { ...section, stories: fresh };
      }),
    );

    return { sections, failures };
  }
}
