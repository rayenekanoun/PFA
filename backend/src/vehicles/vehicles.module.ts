import { Module } from '@nestjs/common';
import { QueuesModule } from '../common/queues.module';
import { PidCatalogModule } from '../pid-catalog/pid-catalog.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [PrismaModule, PidCatalogModule, QueuesModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
