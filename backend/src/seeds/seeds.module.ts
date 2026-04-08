import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SeedsService } from './seeds.service';

@Module({
  imports: [PrismaModule],
  providers: [SeedsService],
  exports: [SeedsService],
})
export class SeedsModule {}
