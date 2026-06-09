import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  /** 6-digit numeric OTP sent to the user's inbox */
  @IsString()
  @Length(6, 6)
  code: string;
}
