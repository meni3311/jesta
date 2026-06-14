import {
  IsString, IsNumber, IsInt, IsISO8601,
  Min, MaxLength, IsOptional,
} from 'class-validator';

/**
 * PATCH /jobs/:id — all fields optional; only provided fields are updated.
 * Address / coordinates are intentionally NOT editable here: moving a
 * published Jesta would silently invalidate applicants' distance decisions.
 */
export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pay?: number;          // hourly rate in NIS

  @IsOptional()
  @IsInt()
  @Min(1)
  requiredWorkers?: number;

  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @IsOptional()
  @IsISO8601()
  endTime?: string;
}
