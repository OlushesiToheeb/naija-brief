import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import type { Brief } from "@naija-brief/shared";
import { BriefStore } from "./brief-store.service";
import { todayKey } from "./date.util";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Read-only brief endpoints. Generation (/generate) and its status (/status)
// live in JobsController, which owns the durable job queue.
@Controller()
export class BriefController {
  constructor(private readonly store: BriefStore) {}

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
      const hasStart = match[1] !== "";
      const hasEnd = match[2] !== "";
      let start: number;
      let end = total - 1;
      if (!hasStart) {
        // Suffix range "bytes=-N": the final N bytes (N=0 is unsatisfiable).
        const n = hasEnd ? Number(match[2]) : 0;
        start = n > 0 ? Math.max(0, total - n) : total;
      } else {
        start = Number(match[1]);
        if (hasEnd) {
          const e = Number(match[2]);
          if (e < end) end = e;
        }
      }
      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start > end ||
        start >= total
      ) {
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
