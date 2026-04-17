import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateVehicleDto {
  @ApiPropertyOptional({ example: 'sim-demo-updated' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  public mqttCarId?: string;

  @ApiPropertyOptional({ example: '1HGCM82633A004352' })
  @IsOptional()
  @IsString()
  @Length(11, 32)
  public vin?: string;

  @ApiPropertyOptional({ example: 'Toyota' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  public make?: string;

  @ApiPropertyOptional({ example: 'Corolla' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  public model?: string;

  @ApiPropertyOptional({ example: 2017 })
  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2100)
  public year?: number;
}
