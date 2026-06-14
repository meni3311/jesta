import {
  IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';

export class CreateRatingDto {
  @IsUUID()
  jobId!: string;

  @IsUUID()
  toUserId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  comment?: string;
}
