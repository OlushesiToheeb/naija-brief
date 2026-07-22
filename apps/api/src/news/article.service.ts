import { Injectable, Logger } from "@nestjs/common";

// Kept in sync with news.service.ts's decoding table on purpose: this service
// is deliberately self-contained so it can fetch a full article without pulling
// in (or perturbing) the RSS ingestion path.
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

/** Non-content structural blocks we drop before pulling paragraph text. */
const BLOCK_TAGS = ["script", "style", "noscript", "nav", "header", "footer", "aside"];

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 600_000; // ~600KB cap on the raw HTML we read.
const MAX_TEXT_CHARS = 8_000; // Cap on the clean text we hand to the LLM.
const MIN_TEXT_CHARS = 200; // Below this the extraction is treated as a miss.

@Injectable()
export class ArticleService {
  private readonly logger = new Logger(ArticleService.name);

  private decodeEntities(text: string): string {
    let out = text;
    for (const [entity, ch] of Object.entries(ENTITIES)) {
      out = out.split(entity).join(ch);
    }
    return out.replace(/&#\d+;|&\w+;/g, " ");
  }

  private stripHtml(html = ""): string {
    const text = html.replace(/<[^>]+>/g, " ");
    return this.decodeEntities(text).replace(/\s+/g, " ").trim();
  }

  /**
   * Fetches a web article and returns its main body text, or null. Never throws:
   * any network, protocol, content-type, or parsing problem yields null so the
   * caller can quietly fall back to the RSS summary.
   */
  async fetchArticleText(url: string): Promise<string | null> {
    try {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return null;
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }

      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 NaijaBrief/1.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!res.ok) return null;

      const contentType = res.headers.get("content-type") || "";
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return null;

      const html = await this.readCapped(res);
      if (!html) return null;

      const text = this.extractArticle(html);
      if (!text || text.length < MIN_TEXT_CHARS) return null;
      return text.slice(0, MAX_TEXT_CHARS);
    } catch (err) {
      this.logger.debug(
        `fetchArticleText(${url}) failed: ${(err as Error)?.message ?? err}`,
      );
      return null;
    }
  }

  /** Reads the response body but stops once ~MAX_BODY_BYTES have arrived. */
  private async readCapped(res: Response): Promise<string> {
    const body = res.body;
    if (!body) {
      const full = await res.text();
      return full.slice(0, MAX_BODY_BYTES);
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let out = "";
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        out += decoder.decode(value, { stream: true });
        if (bytes >= MAX_BODY_BYTES) break;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    out += decoder.decode();
    return out;
  }

  /**
   * Pulls the main article text out of a full HTML page: drop non-content
   * blocks, collect <p> inner text, then strip/decode/collapse what's left.
   */
  private extractArticle(html: string): string {
    let cleaned = html;
    for (const tag of BLOCK_TAGS) {
      cleaned = cleaned.replace(
        new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi"),
        " ",
      );
    }

    const paragraphs: string[] = [];
    const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    let match: RegExpExecArray | null;
    while ((match = pRegex.exec(cleaned)) !== null) {
      const paragraph = this.stripHtml(match[1]);
      if (paragraph) paragraphs.push(paragraph);
    }

    const joined =
      paragraphs.length > 0 ? paragraphs.join("\n\n") : this.stripHtml(cleaned);
    return joined.trim();
  }
}
