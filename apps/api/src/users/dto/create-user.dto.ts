import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsStrongPassword, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  username?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1
  })
  password!: string;

  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
