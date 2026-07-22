import { ArticleService } from "./article.service";

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

describe("ArticleService.fetchArticleText", () => {
  let service: ArticleService;

  beforeEach(() => {
    service = new ArticleService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("extracts <p> text from a 200 HTML response", async () => {
    const body =
      `<html><head><style>.a{}</style></head><body>` +
      `<nav>menu junk that should be dropped</nav>` +
      `<article>` +
      `<p>The central bank held its benchmark rate at 26.5 percent on Tuesday, ` +
      `resisting pressure from manufacturers who had lobbied for a cut to ease ` +
      `the cost of borrowing across the wider economy this quarter.</p>` +
      `<p>Governor Olayemi Cardoso said inflation had eased for the third month ` +
      `running, but warned that food prices remained stubbornly high and that ` +
      `further tightening could not be ruled out if the trend reversed.</p>` +
      `</article>` +
      `<footer>copyright junk</footer>` +
      `</body></html>`;
    const spy = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(htmlResponse(body));

    const text = await service.fetchArticleText("https://example.com/story");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(text).toContain("26.5 percent");
    expect(text).toContain("Olayemi Cardoso");
    expect(text).not.toContain("menu junk");
    expect(text).not.toContain("copyright junk");
  });

  it("returns null on a non-2xx response", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(htmlResponse("<p>should be ignored</p>", 404));

    const text = await service.fetchArticleText("https://example.com/missing");
    expect(text).toBeNull();
  });

  it("returns null for a non-http url without fetching", async () => {
    const spy = jest.spyOn(global, "fetch");

    const text = await service.fetchArticleText("ftp://example.com/story");

    expect(text).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("never throws when fetch rejects", async () => {
    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("network down"));

    await expect(
      service.fetchArticleText("https://example.com/story"),
    ).resolves.toBeNull();
  });

  it("returns null when the extracted text is too short", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(htmlResponse("<p>too short</p>"));

    const text = await service.fetchArticleText("https://example.com/thin");
    expect(text).toBeNull();
  });

  it("returns null on a non-HTML content-type", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const text = await service.fetchArticleText("https://example.com/api");
    expect(text).toBeNull();
  });
});
