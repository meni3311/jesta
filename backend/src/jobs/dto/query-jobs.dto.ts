import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryJobsDto {
  /** Centre-point latitude for radius filter */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  /** Centre-point longitude for radius filter */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  /** Search radius in km (default 10) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  radius?: number;

  /** Minimum hourly pay (NIS) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPay?: number;
}
