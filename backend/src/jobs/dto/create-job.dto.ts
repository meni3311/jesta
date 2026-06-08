import {
  IsString, IsNumber, IsArray, IsISO8601,
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
}
