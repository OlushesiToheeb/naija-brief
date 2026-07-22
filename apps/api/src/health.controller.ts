import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // Liveness + DB readiness in one probe. A cheap SELECT 1 confirms the pool can
  // actually reach Postgres, so a healthy-looking process with a dead database
  // reports 503 instead of a false 200.
  @Get("health")
  @SkipThrottle()
  async health(): Promise<{ status: string }> {
    try {
      await this.ds.query("SELECT 1");
      return { status: "ok" };
    } catch {
      throw new ServiceUnavailableException({ status: "error" });
    }
  }
}
