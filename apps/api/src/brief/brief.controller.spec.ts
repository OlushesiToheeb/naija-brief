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
    findAudio: jest.fn(),
  } as unknown as jest.Mocked<BriefStore>;
  return { controller: new BriefController(briefService, store), briefService, store };
}

interface FakeRes {
  statusCode: number;
  headers: Record<string, string | number>;
  body: Buffer | null;
  setHeader(k: string, v: string | number): FakeRes;
  status(c: number): FakeRes;
  end(b?: Buffer): FakeRes;
}
function mockRes(): FakeRes {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    end(b) {
      if (b) this.body = b;
      return this;
    },
  };
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

  describe("getAudio", () => {
    const audio = { data: Buffer.alloc(2048, 7), mime: "audio/mpeg" };

    it("serves the full body with the stored mime when there is no Range", async () => {
      const { controller, store } = make();
      store.findAudio.mockResolvedValue(audio);
      const res = mockRes();
      await controller.getAudio("2026-07-22", undefined, res as never);
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("audio/mpeg");
      expect(res.headers["content-length"]).toBe(2048);
      expect(res.headers["accept-ranges"]).toBe("bytes");
      expect(res.body?.length).toBe(2048);
    });

    it("answers a byte-range with 206 Partial Content", async () => {
      const { controller, store } = make();
      store.findAudio.mockResolvedValue(audio);
      const res = mockRes();
      await controller.getAudio("2026-07-22", "bytes=0-1023", res as never);
      expect(res.statusCode).toBe(206);
      expect(res.headers["content-range"]).toBe("bytes 0-1023/2048");
      expect(res.headers["content-length"]).toBe(1024);
      expect(res.body?.length).toBe(1024);
    });

    it("returns 416 for an unsatisfiable range", async () => {
      const { controller, store } = make();
      store.findAudio.mockResolvedValue(audio);
      const res = mockRes();
      await controller.getAudio("2026-07-22", "bytes=9999-", res as never);
      expect(res.statusCode).toBe(416);
      expect(res.headers["content-range"]).toBe("bytes */2048");
    });

    it("404s when there is no audio for the date", async () => {
      const { controller, store } = make();
      store.findAudio.mockResolvedValue(null);
      await expect(
        controller.getAudio("2026-07-22", undefined, mockRes() as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
