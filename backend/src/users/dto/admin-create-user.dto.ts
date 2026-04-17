import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class AdminCreateUserDto {
  @ApiProperty()
  @IsEmail()
  public email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  public password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  public displayName!: string;

  @ApiPropertyOptional({ enum: UserRole, example: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  public role?: UserRole;
}
