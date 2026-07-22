import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GenerationJobEntity } from "../entities/generation-job.entity";
import { BriefModule } from "../brief/brief.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";

// Depends on BriefModule (one-way: Jobs → Brief) for the generation pipeline.
// The daily cron and generate/status endpoints live here, not in BriefModule,
// so there is no circular dependency.
@Module({
  imports: [TypeOrmModule.forFeature([GenerationJobEntity]), BriefModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
