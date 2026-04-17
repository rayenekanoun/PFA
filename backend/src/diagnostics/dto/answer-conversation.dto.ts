import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class AnswerConversationDto {
  @ApiProperty({ example: 'What do these results mean for the oxygen sensor?' })
  @IsString()
  @Length(2, 4000)
  public question!: string;
}
