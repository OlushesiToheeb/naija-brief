import { BriefService } from "./brief.service";
import { NewsService } from "../news/news.service";
import { SummarizeService } from "../summarize/summarize.service";
import { TtsService } from "../tts/tts.service";
import { BriefStore } from "./brief-store.service";
import type { Brief } from "@naija-brief/shared";

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeService(opts: { skip?: boolean } = {}) {
  const news = { fetchAllSections: jest.fn() } as unknown as Mocked<NewsService>;
  const summarize = {
    summarizeSection: jest.fn(),
    writeIntroOutro: jest.fn().mockResolvedValue({ intro: "hi", outro: "bye" }),
  } as unknown as Mocked<SummarizeService>;
  const tts = {
    skip: opts.skip ?? false,
    synthesize: jest.fn(),
  } as unknown as TtsService & { synthesize: jest.Mock };
  const store = {
    save: jest.fn().mockResolvedValue(undefined),
    updateAudio: jest.fn().mockResolvedValue(true),
    findByDate: jest.fn().mockResolvedValue({ date: "x", sections: [] }),
  } as unknown as Mocked<BriefStore>;

  const service = new BriefService(
    news as unknown as NewsService,
    summarize as unknown as SummarizeService,
    tts,
    store as unknown as BriefStore,
  );
  return { service, news, summarize, tts, store };
}

const twoSections = [
  { id: "politics", title: "Politics", focus: "", feeds: [], stories: [{ title: "a" }] },
  { id: "tech", title: "Tech", focus: "", feeds: [], stories: [{ title: "b" }] },
];

const briefDto = {
  date: "2026-07-22",
  intro: "Good morning",
  outro: "Bye",
  sections: [{ id: "politics", title: "Politics", script: "s", stories: [] }],
} as unknown as Brief;

describe("BriefService.generateText", () => {
  it("throws when no stories are fetched", async () => {
    const { service, news } = makeService();
    news.fetchAllSections.mockResolvedValue({
      sections: [{ id: "politics", stories: [] }],
      failures: [],
    });
    await expect(service.generateText()).rejects.toThrow(/No stories/);
  });

  it("isolates a failing section and saves the text with no audio yet", async () => {
    const { service, news, summarize, store } = makeService();
    news.fetchAllSections.mockResolvedValue({ sections: twoSections, failures: [] });
    summarize.summarizeSection
      .mockRejectedValueOnce(new Error("bad JSON")) // politics fails
      .mockResolvedValueOnce({ id: "tech", title: "Tech", script: "s", stories: [{ id: "tech-1" }] });

    const { date } = await service.generateText();

    expect(date).toBeTruthy();
    const saved = store.save.mock.calls[0][0];
    expect(saved.sectionsFailed).toEqual([{ section: "Politics", error: "bad JSON" }]);
    expect(saved.sections.map((s: { id: string }) => s.id)).toEqual(["tech"]);
    // Audio is attached later by a separate TTS job.
    expect(saved.audio).toBeNull();
    expect(saved.audioBuffer).toBeNull();
  });
});

describe("BriefService.synthesizeForDate", () => {
  it("synthesizes ordered segments and attaches audio via updateAudio", async () => {
    const { service, tts, store } = makeService();
    store.findByDate.mockResolvedValue(briefDto);
    const markers = [{ id: "intro", startSec: 0 }];
    tts.synthesize.mockResolvedValue({
      audio: Buffer.from("ID3"),
      mime: "audio/mpeg",
      durationSec: 42.6,
      markers,
    });

    await service.synthesizeForDate("2026-07-22");

    const segments = tts.synthesize.mock.calls[0][0] as { id: string }[];
    expect(segments.map((s) => s.id)).toEqual(["intro", "politics", "outro"]);
    const audioArg = store.updateAudio.mock.calls[0][1];
    expect(audioArg).toMatchObject({ mime: "audio/mpeg", durationSec: 43, markers, error: null });
    expect(audioArg.buffer).toBeInstanceOf(Buffer);
  });

  it("propagates a TTS failure so the job can retry it", async () => {
    const { service, tts, store } = makeService();
    store.findByDate.mockResolvedValue(briefDto);
    tts.synthesize.mockRejectedValue(new Error("model download failed"));

    await expect(service.synthesizeForDate("2026-07-22")).rejects.toThrow(/model download/);
    expect(store.updateAudio).not.toHaveBeenCalled();
  });

  it("records 'no audio' without calling TTS when TTS is disabled", async () => {
    const { service, tts, store } = makeService({ skip: true });
    store.findByDate.mockResolvedValue(briefDto);

    await service.synthesizeForDate("2026-07-22");

    expect(tts.synthesize).not.toHaveBeenCalled();
    expect(store.updateAudio).toHaveBeenCalledWith("2026-07-22", {
      buffer: null,
      mime: null,
      durationSec: null,
      markers: null,
      error: null,
    });
  });
});

describe("BriefService.recordAudioError", () => {
  it("writes the failure onto the brief's audio columns via updateAudio", async () => {
    const { service, store } = makeService();
    await service.recordAudioError("2026-07-22", "voicing failed");
    expect(store.updateAudio).toHaveBeenCalledWith("2026-07-22", {
      buffer: null,
      mime: null,
      durationSec: null,
      markers: null,
      error: "voicing failed",
    });
  });
});

describe("BriefService.generateBrief (wrapper)", () => {
  it("keeps the text brief when TTS fails, recording audioError", async () => {
    const { service, news, summarize, tts, store } = makeService();
    news.fetchAllSections.mockResolvedValue({ sections: twoSections, failures: [] });
    summarize.summarizeSection.mockResolvedValue({
      id: "politics",
      title: "Politics",
      script: "s",
      stories: [{ id: "politics-1" }],
    });
    store.findByDate.mockResolvedValue(briefDto);
    tts.synthesize.mockRejectedValue(new Error("model download failed"));

    await service.generateBrief();

    const saved = store.save.mock.calls[0][0];
    expect(saved.audio).toBeNull();
    const errCall = store.updateAudio.mock.calls.find((c) => c[1].error);
    expect(errCall?.[1].error).toBe("model download failed");
  });
});
