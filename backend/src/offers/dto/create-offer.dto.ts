import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateOfferDto {
  @IsUUID()
  jobId!: string;

  @IsUUID()
  workerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
