import { IsUUID } from 'class-validator';

export class ApplyJobDto {
  /** The worker's user ID (temp: from body. Replace with JWT guard sub later.) */
  @IsUUID()
  workerId: string;
}
