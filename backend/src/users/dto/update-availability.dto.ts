import {
  IsArray, IsBoolean, IsOptional, IsString, MaxLength,
} from 'class-validator';

/**
 * Worker availability profile for Pro direct hiring.
 * { open: false } removes the worker from the browse list.
 */
export class UpdateAvailabilityDto {
  @IsBoolean()
  open!: boolean;            // visible to Pro employers for direct offers?

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  days?: string[];           // e.g. ["א", "ב", "ה"]

  @IsOptional()
  @IsString()
  @MaxLength(60)
  hours?: string;            // e.g. "16:00-22:00"

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
