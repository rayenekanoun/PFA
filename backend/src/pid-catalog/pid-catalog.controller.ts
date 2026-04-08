import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PidCatalogService } from './pid-catalog.service';

@ApiTags('pid-catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pid-catalog')
export class PidCatalogController {
  public constructor(private readonly pidCatalogService: PidCatalogService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List the canonical OBD PID catalog. Admin only.' })
  public listCatalog() {
    return this.pidCatalogService.listCatalog();
  }
}
