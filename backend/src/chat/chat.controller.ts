import {
  Controller, Get, Post, Param,
  Body, HttpCode, HttpStatus,
  UseGuards, Req,
} from '@nestjs/common';
import { ChatService }    from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard }   from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)   // all chat routes require auth
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ── GET /api/chats ────────────────────────────────────────────────────────
  @Get()
  listChats(@Req() req: any) {
    return this.chatService.listChats(req.user.sub);
  }

  // ── GET /api/chats/:id/messages ───────────────────────────────────────────
  @Get(':id/messages')
  getMessages(@Req() req: any, @Param('id') chatId: string) {
    return this.chatService.getMessages(chatId, req.user.sub);
  }

  // ── POST /api/chats/:id/messages ──────────────────────────────────────────
  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  sendMessage(
    @Req() req: any,
    @Param('id') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(chatId, req.user.sub, dto);
  }
}
