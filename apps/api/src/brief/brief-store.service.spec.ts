import { BriefStore } from "./brief-store.service";
import type { Repository } from "typeorm";
import type { BriefEntity } from "../entities/brief.entity";

describe("BriefStore.updateAudio", () => {
  it("updates only the audio columns, keyed by date", async () => {
    const update = jest.fn().mockResolvedValue({ affected: 1 });
    const store = new BriefStore({ update } as unknown as Repository<BriefEntity>);
    const markers = [{ id: "intro", startSec: 0 }];

    const ok = await store.updateAudio("2026-07-22", {
      buffer: Buffer.from("mp3"),
      mime: "audio/mpeg",
      durationSec: 42,
      markers,
      error: null,
    });

    expect(ok).toBe(true);
    const [criteria, patch] = update.mock.calls[0];
    expect(criteria).toEqual({ date: "2026-07-22" });
    expect(patch).toEqual({
      audioData: expect.any(Buffer),
      audioMime: "audio/mpeg",
      audioDurationSec: 42,
      audioMarkers: markers,
      audioError: null,
    });
    // Must never drag in the sections/stories tree.
    expect(Object.keys(patch as object)).not.toContain("sections");
  });

  it("returns false when no brief exists for the date", async () => {
    const update = jest.fn().mockResolvedValue({ affected: 0 });
    const store = new BriefStore({ update } as unknown as Repository<BriefEntity>);

    const ok = await store.updateAudio("1999-01-01", {
      buffer: null,
      mime: null,
      durationSec: null,
      markers: null,
      error: null,
    });

    expect(ok).toBe(false);
  });
});
