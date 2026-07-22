import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import type { AskRequest } from "@naija-brief/shared";
import { ChatMessageDto } from "./chat.dto";

export class AskRequestDto implements AskRequest {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" })
  date!: string;

  @IsString()
  @MaxLength(60)
  segmentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages?: ChatMessageDto[];
}
