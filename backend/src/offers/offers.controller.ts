import {
  Controller, Get, Post, Patch, Body, Param, Req, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  // POST /api/offers — Pro employer sends a direct offer to a worker
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: any, @Body() dto: CreateOfferDto) {
    return this.offers.create(req.user.sub, req.user.role, dto);
  }

  // GET /api/offers/me — worker's incoming offers ("הצעות אישיות")
  @Get('me')
  listMine(@Req() req: any) {
    return this.offers.listForWorker(req.user.sub);
  }

  // GET /api/offers/sent — employer's outgoing offers
  @Get('sent')
  listSent(@Req() req: any) {
    return this.offers.listForEmployer(req.user.sub);
  }

  // PATCH /api/offers/:id/accept
  @Patch(':id/accept')
  accept(@Req() req: any, @Param('id') id: string) {
    return this.offers.accept(id, req.user.sub);
  }

  // PATCH /api/offers/:id/decline
  @Patch(':id/decline')
  decline(@Req() req: any, @Param('id') id: string) {
    return this.offers.decline(id, req.user.sub);
  }
}
