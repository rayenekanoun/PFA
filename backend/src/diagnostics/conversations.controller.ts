import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AnswerConversationDto } from './dto/answer-conversation.dto';
import { ConversationsService } from './conversations.service';

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  public constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'List saved diagnostic conversations visible to the current user.' })
  public listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.conversationsService.listConversations(user);
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Get one diagnostic conversation with its full message history.' })
  public getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
  ) {
    return this.conversationsService.getConversation(user, conversationId);
  }

  @Post(':conversationId/messages')
  @ApiOperation({ summary: 'Ask a follow-up question using only the saved report and summary data.' })
  public answerConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: AnswerConversationDto,
  ) {
    return this.conversationsService.answerConversation(user, conversationId, dto.question);
  }
}
