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
    @Res() res: Response,
  ): Promise<void> {
    const clean = date.replace(/\.wav$/, "");
    if (!DATE_RE.test(clean)) throw new BadRequestException("Invalid date.");
    const wav = await this.store.findAudio(clean);
    if (!wav) throw new NotFoundException("No audio for this date.");
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", wav.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(wav);
  }
}
