import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PidCatalogController } from './pid-catalog.controller';
import { PidCatalogService } from './pid-catalog.service';

@Module({
  imports: [PrismaModule],
  providers: [PidCatalogService],
  controllers: [PidCatalogController],
  exports: [PidCatalogService],
})
export class PidCatalogModule {}
