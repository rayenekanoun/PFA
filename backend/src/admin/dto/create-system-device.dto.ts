import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class CreateSystemDeviceDto {
  @ApiProperty({ example: 'OBD-QR-001' })
  @IsString()
  @Length(1, 128)
  public deviceCode!: string;

  @ApiPropertyOptional({ example: 'stm32-dev-001' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  public serialNumber?: string;

  @ApiPropertyOptional({ example: 'fw-0.1.0' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  public firmwareVersion?: string;

  @ApiPropertyOptional({ enum: DeviceStatus, example: DeviceStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(DeviceStatus)
  public status?: DeviceStatus;
}
