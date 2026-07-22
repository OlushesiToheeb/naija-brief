import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AudioMarker } from "@naija-brief/shared";

const TTS_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
// Kokoro tops out around 500 phoneme tokens per generation, so long scripts
// are synthesized sentence-pack by sentence-pack and stitched into one WAV.
const MAX_CHUNK_CHARS = 280;

export interface BriefSegment {
  id: string;
  text: string;
}

export interface SynthesisResult {
  wav: Buffer;
  durationSec: number;
  markers: AudioMarker[];
}

interface KokoroAudio {
  audio: Float32Array;
  sampling_rate: number;
}

interface KokoroTTS {
  generate(text: string, opts: { voice: string }): Promise<KokoroAudio>;
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private ttsPromise: Promise<KokoroTTS> | null = null;

  constructor(private readonly config: ConfigService) {}

  get skip(): boolean {
    return this.config.get<string>("SKIP_TTS") === "1";
  }

  private get voice(): string {
    return this.config.get<string>("TTS_VOICE") || "af_heart";
  }

  private async getTTS(): Promise<KokoroTTS> {
    if (!this.ttsPromise) {
      this.ttsPromise = (async () => {
        const { KokoroTTS } = (await import("kokoro-js")) as {
          KokoroTTS: {
            from_pretrained(
              id: string,
              opts: { dtype: string; device: string },
            ): Promise<KokoroTTS>;
          };
        };
        return KokoroTTS.from_pretrained(TTS_MODEL_ID, {
          dtype: "q8",
          device: "cpu",
        });
      })().catch((err: unknown) => {
        // Don't cache a failed load (e.g. a flaky first-run model download):
        // clear the memo so the next generation retries.
        this.ttsPromise = null;
        throw err;
      });
    }
    return this.ttsPromise;
  }

  private chunkParagraph(paragraph: string): string[] {
    const sentences =
      paragraph.match(/[^.!?]+[.!?]+["'’]?\s*|[^.!?]+$/g) || [paragraph];
    const chunks: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length > MAX_CHUNK_CHARS) {
        chunks.push(current.trim());
        current = "";
      }
      if (sentence.length > MAX_CHUNK_CHARS) {
        for (const piece of sentence.split(/,\s*/)) {
          if (current && current.length + piece.length > MAX_CHUNK_CHARS) {
            chunks.push(current.trim());
            current = "";
          }
          current += (current ? ", " : "") + piece;
        }
      } else {
        current += sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(Boolean);
  }

  /**
   * Synthesizes an ordered set of segments into one WAV buffer, returning
   * per-segment start times so the player can jump between sections.
   */
  async synthesize(
    segments: BriefSegment[],
    onProgress?: (msg: string) => void,
  ): Promise<SynthesisResult> {
    const tts = await this.getTTS();

    const pieces: Float32Array[] = [];
    const markers: AudioMarker[] = [];
    let sampleRate = 24000;
    let totalSamples = 0;

    const gap = (seconds: number) =>
      new Float32Array(Math.round(sampleRate * seconds));

    const spoken = segments.filter((s) => s.text && s.text.trim());
    for (let s = 0; s < spoken.length; s++) {
      const segment = spoken[s];
      markers.push({ id: segment.id, startSec: totalSamples / sampleRate });
      onProgress?.(`Voicing ${s + 1}/${spoken.length}: ${segment.id}`);

      const paragraphs = segment.text
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      for (let p = 0; p < paragraphs.length; p++) {
        for (const chunk of this.chunkParagraph(paragraphs[p])) {
          const audio = await tts.generate(chunk, { voice: this.voice });
          sampleRate = audio.sampling_rate;
          pieces.push(audio.audio);
          totalSamples += audio.audio.length;
        }
        if (p < paragraphs.length - 1) {
          const pause = gap(0.35);
          pieces.push(pause);
          totalSamples += pause.length;
        }
      }

      if (s < spoken.length - 1) {
        const pause = gap(0.6);
        pieces.push(pause);
        totalSamples += pause.length;
      }
    }

    const wav = this.encodeWav(pieces, totalSamples, sampleRate);
    return { wav, durationSec: totalSamples / sampleRate, markers };
  }

  private encodeWav(
    pieces: Float32Array[],
    totalSamples: number,
    sampleRate: number,
  ): Buffer {
    const bytesPerSample = 2;
    const dataSize = totalSamples * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
    buffer.writeUInt16LE(bytesPerSample, 32);
    buffer.writeUInt16LE(16, 34); // bits per sample
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    let offset = 44;
    for (const piece of pieces) {
      for (let i = 0; i < piece.length; i++) {
        const clamped = Math.max(-1, Math.min(1, piece[i]));
        buffer.writeInt16LE(Math.round(clamped * 32767), offset);
        offset += 2;
      }
    }
    return buffer;
  }
}
