import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateDiagnosticRequestDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  public vehicleId!: string;

  @ApiProperty({ example: 'My car consumes too much gasoline' })
  @IsString()
  @Length(5, 2000)
  public complaintText!: string;
}
