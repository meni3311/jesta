import {
  IsString, IsNumber, IsInt, IsArray, IsISO8601, IsBoolean,
  Min, MaxLength, IsOptional,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(800)
  description?: string;

  @IsNumber()
  @Min(1)
  pay: number;           // hourly rate in NIS

  @IsOptional()
  @IsInt()
  @Min(1)
  requiredWorkers?: number;   // defaults to 1 in the DB

  @IsString()
  address: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsISO8601()
  startTime: string;     // ISO-8601 date string

  @IsISO8601()
  endTime: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  perks?: string[];

  // "ג'סטה מבוטחת" — Pro-only insurance mode (validated server-side)
  @IsOptional()
  @IsBoolean()
  isInsured?: boolean;

  // "ג'סטה חירום" (System 1) — must start within 3 hours; the server raises
  // the wage by 20% (pay = basePay * 1.2) and notifies available workers.
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  // Job category id — also drives availability matching (System 2)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;
}
