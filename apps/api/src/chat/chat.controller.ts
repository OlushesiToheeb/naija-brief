import { Body, Controller, Post } from "@nestjs/common";
import type { ChatResponse } from "@naija-brief/shared";
import { ChatRequestDto } from "./chat.dto";
import { ChatService } from "./chat.service";

@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post("chat")
  async ask(@Body() body: ChatRequestDto): Promise<ChatResponse> {
    const reply = await this.chat.ask(body.date, body.storyId, body.messages);
    return { reply };
  }
}
