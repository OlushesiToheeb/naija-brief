import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { AskResponse, ChatResponse } from "@naija-brief/shared";
import { ChatRequestDto } from "./chat.dto";
import { AskRequestDto } from "./ask.dto";
import { ChatService } from "./chat.service";

// Both endpoints call the paid LLM, so cap them per-IP well below the global
// default to blunt cost-spiking abuse.
@Controller()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post("chat")
  async ask(@Body() body: ChatRequestDto): Promise<ChatResponse> {
    const reply = await this.chat.ask(body.date, body.storyId, body.messages);
    return { reply };
  }

  @Post("ask")
  async askSegment(@Body() body: AskRequestDto): Promise<AskResponse> {
    const reply = await this.chat.askSegment(
      body.date,
      body.segmentId,
      body.question,
      body.messages,
    );
    return { reply };
  }
}
