import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
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
}
