import {
  IsArray, IsBoolean, IsInt, IsNumber, IsString,
  Matches, Max, Min, ValidateNested, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class AvailabilitySlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;          // 0 = Sunday … 6 = Saturday

  @IsString()
  @Matches(HHMM, { message: 'startTime must be HH:MM' })
  startTime!: string;

  @IsString()
  @Matches(HHMM, { message: 'endTime must be HH:MM' })
  endTime!: string;
}

/**
 * Full availability profile (System 2). The API replaces ALL of the worker's
 * availability rows atomically on every save — the grid UI always submits the
 * complete picture.
 */
export class UpsertAvailabilityDto {
  @IsArray()
  @ArrayMaxSize(84)            // 7 days × 12 two-hour blocks — sanity cap
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots!: AvailabilitySlotDto[];

  @IsNumber()
  @Min(0)
  @Max(500)
  minWage!: number;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  categories!: string[];       // e.g. ['delivery', 'babysit', 'events', 'pets', 'warehouse', 'other']

  @IsBoolean()
  isOpenToOffers!: boolean;    // "פתוח להצעות עבודה ישירות מפרו"
}
