import { ConfigService } from "@nestjs/config";
import { TtsService } from "./tts.service";

function config(values: Record<string, string> = {}): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

describe("TtsService", () => {
  const svc = new TtsService(config());
  // Reach the private helpers for unit testing.
  const chunk = (p: string): string[] =>
    (svc as unknown as { chunkParagraph(p: string): string[] }).chunkParagraph(p);
  const encodeWav = (
    pieces: Float32Array[],
    total: number,
    rate: number,
  ): Buffer =>
    (
      svc as unknown as {
        encodeWav(p: Float32Array[], t: number, r: number): Buffer;
      }
    ).encodeWav(pieces, total, rate);

  describe("skip", () => {
    it("reflects SKIP_TTS", () => {
      expect(new TtsService(config({ SKIP_TTS: "1" })).skip).toBe(true);
      expect(new TtsService(config({})).skip).toBe(false);
    });
  });

  describe("chunkParagraph", () => {
    it("keeps a short paragraph as a single chunk", () => {
      expect(chunk("Short sentence.")).toEqual(["Short sentence."]);
    });

    it("splits long text into chunks under the size cap", () => {
      const sentence = "This is a sentence about Lagos markets today. ";
      const chunks = chunk(sentence.repeat(20));
      expect(chunks.length).toBeGreaterThan(1);
      for (const c of chunks) expect(c.length).toBeLessThanOrEqual(280);
    });

    it("never loses words across the split", () => {
      const text = "One. Two. Three. Four. Five. Six. Seven. Eight.";
      expect(chunk(text).join(" ")).toContain("Eight.");
    });
  });

  describe("encodeWav", () => {
    it("writes a valid mono 16-bit PCM header", () => {
      const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
      const wav = encodeWav([samples], samples.length, 24000);

      expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
      expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
      expect(wav.readUInt16LE(20)).toBe(1); // PCM
      expect(wav.readUInt16LE(22)).toBe(1); // mono
      expect(wav.readUInt32LE(24)).toBe(24000); // sample rate
      expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
      expect(wav.readUInt32LE(40)).toBe(samples.length * 2); // data size
      expect(wav.length).toBe(44 + samples.length * 2);
      // Clipped +1.0 sample maps to 32767.
      expect(wav.readInt16LE(44 + 3 * 2)).toBe(32767);
    });
  });
});
