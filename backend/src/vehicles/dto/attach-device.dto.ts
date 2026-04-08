import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class AttachDeviceDto {
  @ApiProperty({ example: 'stm32-dev-001' })
  @IsString()
  @Length(1, 128)
  public serialNumber!: string;

  @ApiPropertyOptional({ example: 'fw-0.1.0' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  public firmwareVersion?: string;
}
