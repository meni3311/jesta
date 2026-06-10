import {
  Injectable, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { ConfigService }  from '@nestjs/config';
import { PrismaService }  from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const USER_SNIPPET = {
  id:       true,
  fullName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private supabase: SupabaseClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Service-role client used ONLY to broadcast realtime events.
    // The frontend subscribes to channel `chat:{chatId}` with the anon key.
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      this.supabase = createClient(url, key);
    } else {
      this.logger.warn('SUPABASE_URL / SERVICE_ROLE_KEY missing — realtime chat broadcast disabled');
    }
  }

  // ── GET /chats ────────────────────────────────────────────────────────────
  // List all chats the caller participates in (as employer OR worker).
  async listChats(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: {
        OR: [{ employerId: userId }, { workerId: userId }],
      },
      include: {
        employer: { select: USER_SNIPPET },
        worker:   { select: USER_SNIPPET },
        application: {
          include: { job: { select: { id: true, title: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,   // last message preview
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return chats;
  }

  // ── GET /chats/:id/messages ───────────────────────────────────────────────
  async getMessages(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException(`Chat ${chatId} not found`);
    if (chat.employerId !== userId && chat.workerId !== userId) {
      throw new ForbiddenException('You are not a participant of this chat');
    }

    return this.prisma.message.findMany({
      where:   { chatId },
      include: { sender: { select: USER_SNIPPET } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── POST /chats/:id/messages ──────────────────────────────────────────────
  async sendMessage(chatId: string, senderId: string, dto: SendMessageDto) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException(`Chat ${chatId} not found`);
    if (chat.employerId !== senderId && chat.workerId !== senderId) {
      throw new ForbiddenException('You are not a participant of this chat');
    }

    const message = await this.prisma.message.create({
      data: { chatId, senderId, text: dto.text },
      include: { sender: { select: USER_SNIPPET } },
    });

    // Fire-and-forget realtime broadcast — a failure must never lose the
    // message itself (it's already persisted above).
    this.broadcastMessage(chatId, message).catch((err) =>
      this.logger.warn(`Realtime broadcast failed for chat ${chatId}: ${err.message}`),
    );

    return message;
  }

  // ── Supabase Realtime broadcast ───────────────────────────────────────────
  private async broadcastMessage(chatId: string, message: unknown) {
    if (!this.supabase) return;
    const channel = this.supabase.channel(`chat:${chatId}`);
    try {
      await channel.send({
        type:    'broadcast',
        event:   'new-message',
        payload: { message },
      });
    } finally {
      await this.supabase.removeChannel(channel);
    }
  }
}
