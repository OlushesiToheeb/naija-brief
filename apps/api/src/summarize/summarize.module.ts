import { Module } from "@nestjs/common";
import { LlmModule } from "../llm/llm.module";
import { SummarizeService } from "./summarize.service";

@Module({
  imports: [LlmModule],
  providers: [SummarizeService],
  exports: [SummarizeService],
})
export class SummarizeModule {}
