import {
  Controller, Get, Post, Body, Param, Req, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  // POST /api/ratings — submit a 1-5 star rating after a completed gesta
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: any, @Body() dto: CreateRatingDto) {
    return this.ratings.create(req.user.sub, dto);
  }

  // GET /api/ratings/pending — gestas the current user still needs to rate
  @UseGuards(JwtAuthGuard)
  @Get('pending')
  pending(@Req() req: any) {
    return this.ratings.pendingFor(req.user.sub);
  }

  // GET /api/ratings/user/:id — ratings received by a user (public)
  @Get('user/:id')
  forUser(@Param('id') id: string) {
    return this.ratings.forUser(id);
  }
}
