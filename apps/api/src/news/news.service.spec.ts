import { NewsService } from "./news.service";

interface ParserLike {
  parseURL: jest.Mock;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();
}

describe("NewsService.fetchAllSections", () => {
  let service: NewsService;
  let parser: ParserLike;

  beforeEach(() => {
    service = new NewsService();
    parser = (service as unknown as { parser: ParserLike }).parser;
  });

  it("dedupes by normalized title and drops stories older than the cutoff", async () => {
    jest.spyOn(parser, "parseURL").mockResolvedValue({
      items: [
        // The newer of the two title variants (0h) should be the one kept.
        { title: "Big Story Today!", link: "a", isoDate: daysAgo(0), content: "x" },
        { title: "big  story today", link: "b", isoDate: daysAgo(0.25), content: "y" },
        { title: "Ancient News", link: "c", isoDate: daysAgo(3), content: "z" },
      ],
    });

    const { sections } = await service.fetchAllSections();
    const politics = sections.find((s) => s.id === "politics")!;

    const titles = politics.stories.map((s) => s.title);
    // The two title variants collapse to one (the newer), the 3-day-old is dropped.
    expect(titles).toContain("Big Story Today!");
    expect(titles).not.toContain("Ancient News");
    expect(titles.filter((t) => /big story today/i.test(t))).toHaveLength(1);
  });

  it("records a failing feed without sinking the whole fetch", async () => {
    jest.spyOn(parser, "parseURL").mockImplementation((url: string) => {
      if (url.includes("punchng")) return Promise.reject(new Error("boom"));
      return Promise.resolve({
        items: [
          { title: "Reachable", link: "a", isoDate: daysAgo(0), content: "x" },
        ],
      });
    });

    const { sections, failures } = await service.fetchAllSections();

    expect(failures.some((f) => f.source === "Punch")).toBe(true);
    // Other feeds still populate their sections.
    expect(sections.find((s) => s.id === "tech")!.stories.length).toBeGreaterThan(0);
  });

  it("strips HTML tags and entities from article content", async () => {
    jest.spyOn(parser, "parseURL").mockResolvedValue({
      items: [
        {
          title: "Tagged",
          link: "a",
          isoDate: daysAgo(0),
          // rss-parser maps content:encoded -> contentEncoded via customFields;
          // parseURL is mocked here, so provide the already-mapped field.
          contentEncoded: "<p>Hello&nbsp;<b>world</b></p><script>evil()</script>",
        },
      ],
    });

    const { sections } = await service.fetchAllSections();
    const story = sections[0].stories[0];
    expect(story.content).toBe("Hello world");
    expect(story.content).not.toContain("<");
    expect(story.content).not.toContain("evil");
  });
});
