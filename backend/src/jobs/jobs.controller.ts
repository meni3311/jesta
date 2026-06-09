import {
  Controller, Get, Post, Param,
  Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JobsService }   from './jobs.service';
import { CreateJobDto }  from './dto/create-job.dto';
import { QueryJobsDto }  from './dto/query-jobs.dto';
import { ApplyJobDto }   from './dto/apply-job.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /**
   * GET /api/jobs
   * Returns active jobs, optionally filtered by location radius and min pay.
   * Query params: lat, lng, radius (km), minPay
   */
  @Get()
  findAll(@Query() query: QueryJobsDto) {
    return this.jobsService.findAll(query);
  }

  /**
   * GET /api/jobs/:id
   * Returns a single job with employer info and applications.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  /**
   * POST /api/jobs
   * Employer posts a new job.
   * Body: CreateJobDto
   *
   * NOTE: In production this route should be guarded by a JWT auth guard
   * that sets req.user.  For now the employerId is passed in the body
   * for development convenience.
   */
  @Post()
  create(
    @Body('employerId') employerId: string,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.create(employerId, dto);
  }

  /**
   * POST /api/jobs/:id/apply
   * Worker one-tap applies to a job ("אני בפנים! ⚡").
   * Body: { workerId: string }
   *
   * NOTE: Replace workerId body param with JWT guard (req.user.sub) in production.
   */
  @Post(':id/apply')
  @HttpCode(HttpStatus.CREATED)
  apply(
    @Param('id') jobId: string,
    @Body() dto: ApplyJobDto,
  ) {
    return this.jobsService.apply(jobId, dto);
  }
}
