import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AttachDeviceDto } from './dto/attach-device.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  public constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @ApiOperation({ summary: 'List vehicles available to the current user.' })
  public listVehicles(@CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.listVehicles(user);
  }

  @Get(':vehicleId')
  @ApiOperation({ summary: 'Get a single vehicle with its linked device.' })
  public getVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.vehiclesService.getVehicle(user, vehicleId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a vehicle owned by the current user.' })
  public createVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehiclesService.createVehicle(user, dto);
  }

  @Patch(':vehicleId')
  @ApiOperation({ summary: 'Update a vehicle owned by the current user.' })
  public updateVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.updateVehicle(user, vehicleId, dto);
  }

  @Delete(':vehicleId')
  @ApiOperation({ summary: 'Delete a vehicle owned by the current user.' })
  public deleteVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.vehiclesService.deleteVehicle(user, vehicleId);
  }

  @Post(':vehicleId/devices')
  @ApiOperation({ summary: 'Claim an existing system device by code and link it to a vehicle.' })
  public attachDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: AttachDeviceDto,
  ) {
    return this.vehiclesService.attachDevice(user, vehicleId, dto);
  }

  @Delete(':vehicleId/devices')
  @ApiOperation({ summary: 'Unlink the currently attached device from a vehicle.' })
  public detachDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.vehiclesService.detachDevice(user, vehicleId);
  }

  @Post(':vehicleId/discover-capabilities')
  @ApiOperation({ summary: 'Queue capability discovery for a vehicle.' })
  public discoverCapabilities(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.vehiclesService.discoverCapabilities(user, vehicleId);
  }

  @Get(':vehicleId/supported-pids')
  @ApiOperation({ summary: 'Return the supported PID matrix for a vehicle.' })
  public getSupportedPids(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.vehiclesService.getSupportedPids(user, vehicleId);
  }
}
