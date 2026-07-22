import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BriefController } from "./brief.controller";
import { BriefService } from "./brief.service";
import { BriefStore } from "./brief-store.service";
import type { Brief } from "@naija-brief/shared";

const sampleBrief = { date: "2026-07-22", sections: [] } as unknown as Brief;

function make() {
  const briefService = {
    startGeneration: jest.fn(),
    getStatus: jest.fn(),
  } as unknown as jest.Mocked<BriefService>;
  const store = {
    findByDate: jest.fn(),
    findLatest: jest.fn(),
    listDates: jest.fn(),
  } as unknown as jest.Mocked<BriefStore>;
  return { controller: new BriefController(briefService, store), briefService, store };
}

describe("BriefController", () => {
  it("rejects a malformed date", async () => {
    const { controller } = make();
    await expect(controller.getBrief("not-a-date")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns the brief for a valid date", async () => {
    const { controller, store } = make();
    store.findByDate.mockResolvedValue(sampleBrief);
    await expect(controller.getBrief("2026-07-22")).resolves.toBe(sampleBrief);
  });

  it("falls back to the latest brief when today has none and no date was pinned", async () => {
    const { controller, store } = make();
    store.findByDate.mockResolvedValue(null);
    store.findLatest.mockResolvedValue(sampleBrief);
    await expect(controller.getBrief(undefined)).resolves.toBe(sampleBrief);
  });

  it("404s a pinned date with no brief (no fallback)", async () => {
    const { controller, store } = make();
    store.findByDate.mockResolvedValue(null);
    await expect(controller.getBrief("1999-01-01")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(store.findLatest).not.toHaveBeenCalled();
  });

  it("starts a generation, or 400s when one is already running", () => {
    const { controller, briefService } = make();
    briefService.startGeneration.mockReturnValue(true);
    expect(controller.generate()).toEqual({ status: "running" });

    briefService.startGeneration.mockReturnValue(false);
    expect(() => controller.generate()).toThrow(BadRequestException);
  });
});
