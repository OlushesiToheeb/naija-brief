import { SummarizeService } from "./summarize.service";
import { OpenRouterService } from "../llm/openrouter.service";
import type { FetchedSection } from "../news/news.service";

function section(overrides: Partial<FetchedSection> = {}): FetchedSection {
  return {
    id: "politics",
    title: "Politics & National",
    focus: "focus",
    feeds: [],
    stories: [
      { title: "Story A", link: "a", source: "Punch", publishedAt: null, content: "Body A" },
      { title: "Story B", link: "b", source: "Vanguard", publishedAt: null, content: "Body B" },
    ],
    ...overrides,
  };
}

describe("SummarizeService", () => {
  describe("mock mode", () => {
    const llm = { mockMode: true } as unknown as OpenRouterService;
    const svc = new SummarizeService(llm);

    it("builds a headline script and stories without calling the LLM", async () => {
      const result = await svc.summarizeSection(section());
      expect(result.script).toContain("Story A");
      expect(result.stories).toHaveLength(2);
      expect(result.stories[0].id).toBe("politics-1");
    });
  });

  describe("live mode", () => {
    const chat = jest.fn();
    const llm = {
      mockMode: false,
      chat,
      parseJson: (t: string) => JSON.parse(t),
    } as unknown as OpenRouterService;
    const svc = new SummarizeService(llm);

    afterEach(() => chat.mockReset());

    it("maps the model's chosen article numbers back to real stories", async () => {
      chat.mockResolvedValue(
        JSON.stringify({
          script: "A spoken script.",
          stories: [{ n: 2, headline: "Cleaner headline", summary: "One line." }],
        }),
      );

      const result = await svc.summarizeSection(section());
      expect(result.script).toBe("A spoken script.");
      expect(result.stories).toHaveLength(1);
      expect(result.stories[0]).toMatchObject({
        id: "politics-2",
        headline: "Cleaner headline",
        source: "Vanguard", // article #2
        content: "Body B",
      });
    });

    it("drops story references that point past the candidate list", async () => {
      chat.mockResolvedValue(
        JSON.stringify({
          script: "s",
          stories: [{ n: 99, headline: "ghost" }],
        }),
      );
      const result = await svc.summarizeSection(section());
      expect(result.stories).toHaveLength(0);
    });

    it("returns empty output for a section with no stories, without calling the LLM", async () => {
      const result = await svc.summarizeSection(section({ stories: [] }));
      expect(result.stories).toHaveLength(0);
      expect(chat).not.toHaveBeenCalled();
    });
  });
});
