import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DIAGNOSTICS_QUEUE } from './queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: DIAGNOSTICS_QUEUE })],
  exports: [BullModule],
})
export class QueuesModule {}
