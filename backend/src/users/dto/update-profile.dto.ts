import {
  IsString, IsUrl, IsMobilePhone, MaxLength, IsOptional,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  fullName?: string;

  @IsMobilePhone('he-IL')
  @IsOptional()
  phone?: string;

  /** Public Supabase Storage URL of the new avatar */
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;
}
