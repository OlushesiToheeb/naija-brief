import { ConfigService } from "@nestjs/config";
import { OpenRouterService } from "./openrouter.service";

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe("OpenRouterService", () => {
  describe("parseJson", () => {
    const svc = new OpenRouterService(configWith({}));

    it("parses plain JSON", () => {
      expect(svc.parseJson('{"a":1}')).toEqual({ a: 1 });
    });

    it("strips ```json fences", () => {
      expect(svc.parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it("digs a JSON object out of surrounding prose", () => {
      expect(svc.parseJson('Sure! Here you go: {"a":1} Hope that helps'))
        .toEqual({ a: 1 });
    });

    it("throws on input with no object", () => {
      expect(() => svc.parseJson("no json here")).toThrow(
        /Could not parse/,
      );
    });
  });

  describe("mockMode", () => {
    it("is true only when MOCK_LLM=1", () => {
      expect(new OpenRouterService(configWith({ MOCK_LLM: "1" })).mockMode).toBe(
        true,
      );
      expect(new OpenRouterService(configWith({ MOCK_LLM: "0" })).mockMode).toBe(
        false,
      );
    });
  });

  describe("chat", () => {
    const key = { OPENROUTER_API_KEY: "sk-test", OPENROUTER_MODEL: "m" };

    afterEach(() => jest.restoreAllMocks());

    it("throws a helpful error when no key is set", async () => {
      const svc = new OpenRouterService(configWith({}));
      await expect(svc.chat([{ role: "user", content: "hi" }])).rejects.toThrow(
        /OPENROUTER_API_KEY is not set/,
      );
    });

    it("returns the message content on success", async () => {
      const svc = new OpenRouterService(configWith(key));
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "hello" } }] }),
      } as Response);
      await expect(svc.chat([{ role: "user", content: "hi" }])).resolves.toBe(
        "hello",
      );
    });

    it("does not retry a fatal (non-retryable) status", async () => {
      const svc = new OpenRouterService(configWith(key));
      const spy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      } as Response);
      await expect(svc.chat([{ role: "user", content: "hi" }])).rejects.toThrow(
        /OpenRouter 401/,
      );
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("retries a transient 503 then succeeds", async () => {
      const svc = new OpenRouterService(configWith(key));
      const spy = jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => "unavailable",
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: "ok" } }] }),
        } as Response);
      await expect(svc.chat([{ role: "user", content: "hi" }])).resolves.toBe(
        "ok",
      );
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
