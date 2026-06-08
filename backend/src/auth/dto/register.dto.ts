import {
  IsEmail, IsString, IsEnum,
  MinLength, MaxLength, IsMobilePhone, IsOptional,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsString()
  @MaxLength(100)
  fullName: string;

  @IsEnum(UserRole)
  role: UserRole;           // "WORKER" | "EMPLOYER"

  @IsMobilePhone('he-IL')
  @IsOptional()
  phone?: string;
}
