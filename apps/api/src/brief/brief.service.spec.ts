import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { BriefService } from "./brief.service";
import { NewsService } from "../news/news.service";
import { SummarizeService } from "../summarize/summarize.service";
import { TtsService } from "../tts/tts.service";
import { BriefStore } from "./brief-store.service";

type Mocked<T> = { [K in keyof T]: jest.Mock };

function makeService() {
  const news = { fetchAllSections: jest.fn() } as unknown as Mocked<NewsService>;
  const summarize = {
    summarizeSection: jest.fn(),
    writeIntroOutro: jest.fn().mockResolvedValue({ intro: "hi", outro: "bye" }),
  } as unknown as Mocked<SummarizeService>;
  const tts = {
    skip: false,
    synthesize: jest.fn(),
  } as unknown as TtsService & { synthesize: jest.Mock };
  const store = {
    save: jest.fn().mockResolvedValue(undefined),
    findByDate: jest.fn().mockResolvedValue({ date: "x", sections: [] }),
  } as unknown as Mocked<BriefStore>;
  const config = { get: () => undefined } as unknown as ConfigService;
  const scheduler = { addCronJob: jest.fn() } as unknown as SchedulerRegistry;

  const service = new BriefService(
    news as unknown as NewsService,
    summarize as unknown as SummarizeService,
    tts,
    store as unknown as BriefStore,
    config,
    scheduler,
  );
  return { service, news, summarize, tts, store };
}

const twoSections = [
  { id: "politics", title: "Politics", focus: "", feeds: [], stories: [{ title: "a" }] },
  { id: "tech", title: "Tech", focus: "", feeds: [], stories: [{ title: "b" }] },
];

describe("BriefService.generateBrief", () => {
  it("throws when no stories are fetched", async () => {
    const { service, news } = makeService();
    news.fetchAllSections.mockResolvedValue({
      sections: [{ id: "politics", stories: [] }],
      failures: [],
    });
    await expect(service.generateBrief()).rejects.toThrow(/No stories/);
  });

  it("isolates a failing section instead of aborting the whole brief", async () => {
    const { service, news, summarize, tts, store } = makeService();
    news.fetchAllSections.mockResolvedValue({ sections: twoSections, failures: [] });
    summarize.summarizeSection
      .mockRejectedValueOnce(new Error("bad JSON")) // politics fails
      .mockResolvedValueOnce({ id: "tech", title: "Tech", script: "s", stories: [{ id: "tech-1" }] });
    tts.synthesize.mockResolvedValue({ wav: Buffer.alloc(4), durationSec: 10, markers: [] });

    await service.generateBrief();

    const saved = store.save.mock.calls[0][0];
    expect(saved.sectionsFailed).toEqual([
      { section: "Politics", error: "bad JSON" },
    ]);
    expect(saved.sections.map((s: { id: string }) => s.id)).toEqual(["tech"]);
  });

  it("keeps the text brief when TTS fails, recording audioError", async () => {
    const { service, news, summarize, tts, store } = makeService();
    news.fetchAllSections.mockResolvedValue({ sections: twoSections, failures: [] });
    summarize.summarizeSection.mockResolvedValue({
      id: "politics",
      title: "Politics",
      script: "s",
      stories: [{ id: "politics-1" }],
    });
    tts.synthesize.mockRejectedValue(new Error("model download failed"));

    await service.generateBrief();

    const saved = store.save.mock.calls[0][0];
    expect(saved.audio).toBeNull();
    expect(saved.audioBuffer).toBeNull();
    expect(saved.audioError).toBe("model download failed");
    expect(saved.sections.length).toBeGreaterThan(0);
  });

  it("saves audio + markers on the happy path", async () => {
    const { service, news, summarize, tts, store } = makeService();
    news.fetchAllSections.mockResolvedValue({ sections: twoSections, failures: [] });
    summarize.summarizeSection.mockResolvedValue({
      id: "politics",
      title: "Politics",
      script: "s",
      stories: [{ id: "politics-1" }],
    });
    const markers = [{ id: "intro", startSec: 0 }];
    tts.synthesize.mockResolvedValue({
      wav: Buffer.from("RIFF"),
      durationSec: 42.6,
      markers,
    });

    await service.generateBrief();

    const saved = store.save.mock.calls[0][0];
    expect(saved.audio).toEqual({ durationSec: 43, markers });
    expect(saved.audioBuffer).toBeInstanceOf(Buffer);
  });
});
