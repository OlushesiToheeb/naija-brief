import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import type { Brief, GenerationStatus } from "@naija-brief/shared";
import { BriefService } from "./brief.service";
import { BriefStore } from "./brief-store.service";
import { todayKey } from "./date.util";
import { isAllowedOrigin } from "../common/origin";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller()
export class BriefController {
  constructor(
    private readonly briefService: BriefService,
    private readonly store: BriefStore,
  ) {}

  @Get("brief")
  async getBrief(@Query("date") date?: string): Promise<Brief> {
    if (date && !DATE_RE.test(date)) {
      throw new BadRequestException("Invalid date. Use YYYY-MM-DD.");
    }
    const key = date || todayKey();
    const brief = await this.store.findByDate(key);
    if (brief) return brief;

    // No brief for the requested day: when the caller didn't pin a date, fall
    // back to the most recent one so the app is never empty-handed.
    if (!date) {
      const latest = await this.store.findLatest();
      if (latest) return latest;
    }
    throw new NotFoundException("No brief for this date yet.");
  }

  @Get("briefs")
  async listBriefs(): Promise<{ dates: string[] }> {
    return { dates: await this.store.listDates() };
  }

  @Post("generate")
  @HttpCode(202)
  generate(
    @Headers("origin") origin?: string,
  ): { status: GenerationStatus["status"] } {
    // Generation costs money (LLM) and CPU (TTS). A cross-site page can send a
    // no-preflight POST here, so reject any disallowed browser Origin — CORS
    // alone only hides the response, it doesn't stop the side effect.
    if (!isAllowedOrigin(origin)) {
      throw new ForbiddenException("Cross-origin generation is not allowed.");
    }
    const started = this.briefService.startGeneration();
    if (!started) {
      throw new BadRequestException("A brief is already being generated.");
    }
    return { status: "running" };
  }

  @Get("status")
  getStatus(): GenerationStatus {
    return this.briefService.getStatus();
  }

  @Get("audio/:date")
  async getAudio(
    @Param("date") date: string,
    @Headers("range") range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const clean = date.replace(/\.\w+$/, "");
    if (!DATE_RE.test(clean)) throw new BadRequestException("Invalid date.");
    const audio = await this.store.findAudio(clean);
    if (!audio) throw new NotFoundException("No audio for this date.");

    const { data, mime } = audio;
    const total = data.length;
    res.setHeader("Content-Type", mime);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=86400");

    // Honour byte-range requests (206) — iOS Safari relies on this for media
    // seeking, and it's what Accept-Ranges promises.
    const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      let start = match[1] ? Number(match[1]) : 0;
      let end = match[2] ? Number(match[2]) : total - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= total) end = total - 1;
      if (start > end || start >= total) {
        res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
        return;
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", end - start + 1);
      res.end(data.subarray(start, end + 1));
      return;
    }

    res.setHeader("Content-Length", total);
    res.end(data);
  }
}
