import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Reasoning effort: "none" disables it (cheaper, avoids truncation). */
  reasoningEffort?: string;
}

interface FatalError extends Error {
  fatal?: boolean;
}

@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);

  constructor(private readonly config: ConfigService) {}

  get mockMode(): boolean {
    return this.config.get<string>("MOCK_LLM") === "1";
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async chat(messages: LlmMessage[], opts: ChatOptions = {}): Promise<string> {
    const apiKey = this.config.get<string>("OPENROUTER_API_KEY");
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set. Add it to .env (https://openrouter.ai/keys), or set MOCK_LLM=1 to test without a key.",
      );
    }

    const model =
      opts.model ||
      this.config.get<string>("OPENROUTER_MODEL") ||
      "z-ai/glm-5.2";

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1400,
    };
    // Reasoning models (e.g. deepseek-v4-flash) spend completion tokens thinking.
    // For extractive summarization/QA that's wasted spend and risks truncating
    // the JSON, so default to disabling it. Configurable via LLM_REASONING_EFFORT.
    const effort =
      opts.reasoningEffort ??
      this.config.get<string>("LLM_REASONING_EFFORT") ??
      "none";
    if (effort && effort !== "default") {
      payload.reasoning = { effort };
    }
    const body = JSON.stringify(payload);

    let lastError: Error | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await this.sleep(1500 * attempt);
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost",
            "X-Title": "Naija Brief",
          },
          body,
          signal: AbortSignal.timeout(120_000),
        });

        if (!res.ok) {
          const detail = (await res.text().catch(() => "")).slice(0, 500);
          const err: FatalError = new Error(`OpenRouter ${res.status}: ${detail}`);
          if (!RETRYABLE.has(res.status)) err.fatal = true;
          throw err;
        }

        // Parse inside the try so a truncated 200 body retries like any
        // other transient failure.
        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error(
            `OpenRouter returned no content: ${JSON.stringify(data).slice(0, 300)}`,
          );
        }
        return content;
      } catch (err) {
        const e = err as FatalError;
        lastError = e.fatal
          ? e
          : new Error(`OpenRouter request failed: ${e.message}`);
        if (e.fatal) throw lastError;
      }
    }
    throw lastError ?? new Error("OpenRouter request failed");
  }

  /** Models sometimes wrap JSON in prose or code fences; dig the object out. */
  parseJson<T = unknown>(text: string): T {
    const cleaned = text.replace(/```(?:json)?/gi, "").trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      }
      throw new Error(
        `Could not parse model reply as JSON: ${text.slice(0, 200)}`,
      );
    }
  }
}
