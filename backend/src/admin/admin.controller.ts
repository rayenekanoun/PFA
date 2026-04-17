import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminCreateUserDto } from '../users/dto/admin-create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { CreateVehicleDto } from '../vehicles/dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../vehicles/dto/update-vehicle.dto';
import { CreateSystemDeviceDto } from './dto/create-system-device.dto';
import { UpdateSystemDeviceDto } from './dto/update-system-device.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  public constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Return admin dashboard statistics for users, vehicles, devices, and diagnostics.' })
  public getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users with ownership and diagnostic statistics. Admin only.' })
  public listUsers() {
    return this.adminService.listUsers();
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get one user with owned vehicles. Admin only.' })
  public getUser(@Param('userId') userId: string) {
    return this.adminService.getUser(userId);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a user. Admin only.' })
  public createUser(@Body() dto: AdminCreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:userId')
  @ApiOperation({ summary: 'Update a user. Admin only.' })
  public updateUser(@Param('userId') userId: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(userId, dto);
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'Delete a user. Admin only.' })
  public deleteUser(@Param('userId') userId: string) {
    return this.adminService.deleteUser(userId);
  }

  @Get('vehicles')
  @ApiOperation({ summary: 'List all vehicles with owners. Admin only.' })
  public listVehicles() {
    return this.adminService.listVehicles();
  }

  @Post('users/:userId/vehicles')
  @ApiOperation({ summary: 'Create a vehicle for a user. Admin only.' })
  public createVehicleForUser(
    @Param('userId') userId: string,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.adminService.createVehicleForUser(userId, dto);
  }

  @Patch('vehicles/:vehicleId')
  @ApiOperation({ summary: 'Update any vehicle. Admin only.' })
  public updateVehicle(
    @Param('vehicleId') vehicleId: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.adminService.updateVehicle(vehicleId, dto);
  }

  @Delete('vehicles/:vehicleId')
  @ApiOperation({ summary: 'Delete any vehicle. Admin only.' })
  public deleteVehicle(@Param('vehicleId') vehicleId: string) {
    return this.adminService.deleteVehicle(vehicleId);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List the global device inventory and assignment status. Admin only.' })
  public listDevices() {
    return this.adminService.listDevices();
  }

  @Get('devices/:deviceId')
  @ApiOperation({ summary: 'Get one system device. Admin only.' })
  public getDevice(@Param('deviceId') deviceId: string) {
    return this.adminService.getDevice(deviceId);
  }

  @Post('devices')
  @ApiOperation({ summary: 'Register a new device in the global inventory. Admin only.' })
  public createSystemDevice(@Body() dto: CreateSystemDeviceDto) {
    return this.adminService.createSystemDevice(dto);
  }

  @Patch('devices/:deviceId')
  @ApiOperation({ summary: 'Update a device in the global inventory. Admin only.' })
  public updateSystemDevice(
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateSystemDeviceDto,
  ) {
    return this.adminService.updateSystemDevice(deviceId, dto);
  }

  @Delete('devices/:deviceId')
  @ApiOperation({ summary: 'Delete a device from the global inventory. Admin only.' })
  public deleteSystemDevice(@Param('deviceId') deviceId: string) {
    return this.adminService.deleteSystemDevice(deviceId);
  }
}
