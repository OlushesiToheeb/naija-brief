import { Module } from "@nestjs/common";
import { LlmModule } from "../llm/llm.module";
import { BriefModule } from "../brief/brief.module";
import { NewsModule } from "../news/news.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [LlmModule, BriefModule, NewsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
