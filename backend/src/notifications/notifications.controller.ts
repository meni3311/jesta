import {
  Controller, Get, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import type { NotificationKind } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // GET /api/notifications — { items, unreadCount }
  @Get()
  listMine(@Req() req: any) {
    return this.notifications.listMine(req.user.sub);
  }

  // PATCH /api/notifications/read-all  (before :id so "read-all" isn't an id)
  @Patch('read-all')
  markAllRead(@Req() req: any) {
    return this.notifications.markAllRead(req.user.sub);
  }

  // PATCH /api/notifications/read-types — body { types: NotificationKind[] }
  // Auto-mark-as-read when the user visits the relevant screen.
  @Patch('read-types')
  markReadByTypes(@Req() req: any, @Body() body: { types?: NotificationKind[] }) {
    return this.notifications.markReadByTypes(req.user.sub, body?.types ?? []);
  }

  // PATCH /api/notifications/:id/read
  @Patch(':id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }
}
