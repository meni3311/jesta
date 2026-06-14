import {
  Controller, Get, Post, Patch, Param,
  Body, Query, HttpCode, HttpStatus,
  UseGuards, Req,
} from '@nestjs/common';
import { JobsService }  from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateJobDto } from './dto/update-job.dto';
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
  // (PENDING applicants are redacted for non-Pro employers)
  // Must come BEFORE :id to avoid "employer" being matched as an id
  @UseGuards(JwtAuthGuard)
  @Get('employer')
  getEmployerJobs(@Req() req: any) {
    return this.jobsService.getEmployerJobs(req.user.sub);
  }

  // GET /api/jobs/employer/stats - real aggregates for the dashboard stats bar
  @UseGuards(JwtAuthGuard)
  @Get('employer/stats')
  getEmployerStats(@Req() req: any) {
    return this.jobsService.getEmployerStats(req.user.sub);
  }

  // GET /api/jobs/applications/me - the worker's own applications
  // Must come BEFORE :id so "applications" isn't matched as an id
  @UseGuards(JwtAuthGuard)
  @Get('applications/me')
  getMyApplications(@Req() req: any) {
    return this.jobsService.getMyApplications(req.user.sub);
  }

  // POST /api/jobs/applications/:appId/confirm - worker confirms arrival
  // ("אישור הגעה" — feeds the response-speed part of the Jesta Score)
  @UseGuards(JwtAuthGuard)
  @Post('applications/:appId/confirm')
  @HttpCode(HttpStatus.OK)
  confirmArrival(@Req() req: any, @Param('appId') appId: string) {
    return this.jobsService.confirmArrival(appId, req.user.sub);
  }

  // POST /api/jobs/applications/:appId/claim - worker claims a reopened spot
  // after a JOB_REOPENED notification. First to claim is auto-approved.
  @UseGuards(JwtAuthGuard)
  @Post('applications/:appId/claim')
  @HttpCode(HttpStatus.OK)
  claimReopened(@Req() req: any, @Param('appId') appId: string) {
    return this.jobsService.claimReopened(appId, req.user.sub);
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

  // PATCH /api/jobs/:id - employer edits their own job.
  // Blocked with 409 once a worker has been APPROVED (job is locked).
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobsService.update(id, req.user.sub, dto);
  }

  // PATCH /api/jobs/:id/cancel - employer cancels an OPEN job.
  // 409 once a worker is APPROVED (complete / no-show instead).
  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.jobsService.cancel(id, req.user.sub);
  }

  // POST /api/jobs/:id/apply - worker applies, workerId + role from JWT
  @UseGuards(JwtAuthGuard)
  @Post(':id/apply')
  @HttpCode(HttpStatus.CREATED)
  apply(@Req() req: any, @Param('id') jobId: string) {
    return this.jobsService.apply(jobId, req.user.sub, req.user.role);
  }

  // POST /api/jobs/:id/approve-first - free-tier blind approval:
  // approves the oldest PENDING applicant ("אשר את הראשון")
  @UseGuards(JwtAuthGuard)
  @Post(':id/approve-first')
  @HttpCode(HttpStatus.OK)
  approveFirst(@Req() req: any, @Param('id') jobId: string) {
    return this.jobsService.approveFirst(jobId, req.user.sub);
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

  // PATCH /api/jobs/:jobId/applications/:appId/complete
  // Gesta done -> worker counters + Jesta Score update -> rating prompts
  @UseGuards(JwtAuthGuard)
  @Patch(':jobId/applications/:appId/complete')
  completeApplication(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @Param('appId') appId: string,
  ) {
    return this.jobsService.completeApplication(jobId, appId, req.user.sub);
  }

  // PATCH /api/jobs/:jobId/applications/:appId/no-show
  // Strike escalation + fallback re-invite flow
  @UseGuards(JwtAuthGuard)
  @Patch(':jobId/applications/:appId/no-show')
  markNoShow(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @Param('appId') appId: string,
  ) {
    return this.jobsService.markNoShow(jobId, appId, req.user.sub);
  }
}
