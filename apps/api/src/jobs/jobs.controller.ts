import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
} from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type { GenerationStatus } from "@naija-brief/shared";
import { isAllowedOrigin } from "../common/origin";
import { todayKey } from "../brief/date.util";
import { JobsService } from "./jobs.service";

@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post("generate")
  @HttpCode(202)
  // Generation is the most expensive endpoint (LLM + CPU); keep it tightly capped.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async generate(
    @Headers("origin") origin?: string,
  ): Promise<GenerationStatus> {
    // A cross-site page can send a no-preflight POST here; CORS only hides the
    // response, it doesn't stop the side effect. Reject disallowed Origins.
    if (!isAllowedOrigin(origin)) {
      throw new ForbiddenException("Cross-origin generation is not allowed.");
    }
    // Idempotent: enqueue is deduped, so a double-tap just returns the status.
    await this.jobs.enqueue("generate", todayKey());
    return this.jobs.getStatus();
  }

  @Get("status")
  // The web app polls this during generation — never throttle it.
  @SkipThrottle()
  getStatus(): Promise<GenerationStatus> {
    return this.jobs.getStatus();
  }
}
