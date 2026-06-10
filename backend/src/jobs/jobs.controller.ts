import {
  Controller, Get, Post, Patch, Param,
  Body, Query, HttpCode, HttpStatus,
  UseGuards, Req,
} from '@nestjs/common';
import { JobsService }  from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // GET /api/jobs - public feed
  @Get()
  findAll(@Query() query: QueryJobsDto) {
    return this.jobsService.findAll(query);
  }

  // GET /api/jobs/employer - employer's own jobs with applicants
  // Must come BEFORE :id to avoid "employer" being matched as an id
  @UseGuards(JwtAuthGuard)
  @Get('employer')
  getEmployerJobs(@Req() req: any) {
    return this.jobsService.getEmployerJobs(req.user.sub);
  }

  // GET /api/jobs/applications/me - the worker's own applications
  // Must come BEFORE :id so "applications" isn't matched as an id
  @UseGuards(JwtAuthGuard)
  @Get('applications/me')
  getMyApplications(@Req() req: any) {
    return this.jobsService.getMyApplications(req.user.sub);
  }

  // GET /api/jobs/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  // POST /api/jobs - employer creates a job, employerId + role from JWT
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: any, @Body() dto: CreateJobDto) {
    return this.jobsService.create(req.user.sub, req.user.role, dto);
  }

  // POST /api/jobs/:id/apply - worker applies, workerId + role from JWT
  @UseGuards(JwtAuthGuard)
  @Post(':id/apply')
  @HttpCode(HttpStatus.CREATED)
  apply(@Req() req: any, @Param('id') jobId: string) {
    return this.jobsService.apply(jobId, req.user.sub, req.user.role);
  }

  // PATCH /api/jobs/:jobId/applications/:appId/approve
  // Approve worker -> lock job -> create chat
  @UseGuards(JwtAuthGuard)
  @Patch(':jobId/applications/:appId/approve')
  approveApplication(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @Param('appId') appId: string,
  ) {
    return this.jobsService.approveApplication(jobId, appId, req.user.sub);
  }

  // PATCH /api/jobs/:jobId/applications/:appId/reject
  @UseGuards(JwtAuthGuard)
  @Patch(':jobId/applications/:appId/reject')
  rejectApplication(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @Param('appId') appId: string,
  ) {
    return this.jobsService.rejectApplication(jobId, appId, req.user.sub);
  }
}
