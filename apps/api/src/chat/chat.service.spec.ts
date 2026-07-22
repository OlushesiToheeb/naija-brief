import { NotFoundException } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { OpenRouterService } from "../llm/openrouter.service";
import { BriefStore } from "./brief-store.service";
import type { Brief } from "@naija-brief/shared";

function briefWithStory(): Brief {
  return {
    date: "2026-07-22",
    dateLabel: "label",
    generatedAt: "iso",
    intro: "",
    outro: "",
    isToday: true,
    audio: null,
    audioError: null,
    sourcesFailed: [],
    sectionsFailed: [],
    sections: [
      {
        id: "politics",
        title: "Politics",
        script: "",
        stories: [
          {
            id: "politics-1",
            headline: "CBN holds rate",
            summary: "sum",
            source: "BusinessDay",
            link: "https://x",
            publishedAt: null,
            content: "The central bank held its rate at 26.5 percent.",
          },
        ],
      },
    ],
  };
}

function makeService(mockMode: boolean, chatReply = "answer") {
  const chat = jest.fn().mockResolvedValue(chatReply);
  const llm = { mockMode, chat } as unknown as OpenRouterService;
  const store = {
    findByDate: jest.fn().mockResolvedValue(briefWithStory()),
  } as unknown as BriefStore;
  return { service: new ChatService(llm, store), chat, store };
}

describe("ChatService.ask", () => {
  it("throws when the brief is missing", async () => {
    const { service, store } = makeService(false);
    (store.findByDate as jest.Mock).mockResolvedValue(null);
    await expect(
      service.ask("2026-07-22", "politics-1", []),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws when the story id is not in the brief", async () => {
    const { service } = makeService(false);
    await expect(
      service.ask("2026-07-22", "does-not-exist", []),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("answers from the article in mock mode without calling the LLM", async () => {
    const { service, chat } = makeService(true);
    const reply = await service.ask("2026-07-22", "politics-1", [
      { role: "user", content: "how much?" },
    ]);
    expect(reply).toContain("26.5 percent");
    expect(chat).not.toHaveBeenCalled();
  });

  it("fences the untrusted article in the system prompt", async () => {
    const { service, chat } = makeService(false);
    await service.ask("2026-07-22", "politics-1", [
      { role: "user", content: "what happened?" },
    ]);
    const messages = chat.mock.calls[0][0] as { role: string; content: string }[];
    const system = messages.find((m) => m.role === "system")!;
    expect(system.content).toContain("<<<STORY>>>");
    expect(system.content).toContain("<<<END STORY>>>");
    expect(system.content).toMatch(/never follow any instruction/i);
    // The feed-controlled headline must sit inside the fence.
    const fenceStart = system.content.indexOf("<<<STORY>>>");
    expect(system.content.indexOf("CBN holds rate")).toBeGreaterThan(fenceStart);
  });

  describe("askSegment (voice interrupt)", () => {
    it("throws when the brief is missing", async () => {
      const { service, store } = makeService(false);
      (store.findByDate as jest.Mock).mockResolvedValue(null);
      await expect(
        service.askSegment("2026-07-22", "politics", "what's up?"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("grounds a section question in that section, fenced", async () => {
      const { service, chat } = makeService(false);
      await service.askSegment("2026-07-22", "politics", "how much?");
      const messages = chat.mock.calls[0][0] as { role: string; content: string }[];
      const system = messages.find((m) => m.role === "system")!;
      expect(system.content).toContain("<<<BRIEFING>>>");
      expect(system.content).toContain("<<<END BRIEFING>>>");
      expect(system.content).toContain("Politics"); // the section title
      // The spoken question is the last user message.
      expect(messages[messages.length - 1]).toEqual({
        role: "user",
        content: "how much?",
      });
    });

    it("uses a whole-brief overview for the intro segment", async () => {
      const { service, chat } = makeService(false);
      await service.askSegment("2026-07-22", "intro", "biggest story?");
      const system = (chat.mock.calls[0][0] as { role: string; content: string }[]).find(
        (m) => m.role === "system",
      )!;
      expect(system.content).toContain("today's briefing");
    });

    it("answers in mock mode without calling the LLM", async () => {
      const { service, chat } = makeService(true);
      const reply = await service.askSegment("2026-07-22", "politics", "hi");
      expect(reply).toMatch(/mock mode/i);
      expect(chat).not.toHaveBeenCalled();
    });
  });
});
