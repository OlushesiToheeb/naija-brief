import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BriefEntity } from "../entities/brief.entity";
import { SectionEntity } from "../entities/section.entity";
import { StoryEntity } from "../entities/story.entity";
import { NewsModule } from "../news/news.module";
import { SummarizeModule } from "../summarize/summarize.module";
import { TtsModule } from "../tts/tts.module";
import { BriefController } from "./brief.controller";
import { BriefService } from "./brief.service";
import { BriefStore } from "./brief-store.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([BriefEntity, SectionEntity, StoryEntity]),
    NewsModule,
    SummarizeModule,
    TtsModule,
  ],
  controllers: [BriefController],
  providers: [BriefService, BriefStore],
  exports: [BriefStore, BriefService],
})
export class BriefModule {}
