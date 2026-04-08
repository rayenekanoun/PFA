import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  DIAGNOSTICS_QUEUE,
  JOB_DISCOVER_VEHICLE_CAPABILITIES,
  JOB_EXECUTE_DIAGNOSTIC_REQUEST,
  JOB_GENERATE_DIAGNOSTIC_REPORT,
} from '../../common/queue.constants';
import { DiagnosticsService } from '../diagnostics.service';

@Processor(DIAGNOSTICS_QUEUE)
export class DiagnosticsProcessor extends WorkerHost {
  public constructor(private readonly diagnosticsService: DiagnosticsService) {
    super();
  }

  public async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOB_DISCOVER_VEHICLE_CAPABILITIES:
        return this.diagnosticsService.handleCapabilityDiscoveryJob(
          job.data as { vehicleId: string; deviceId?: string },
        );
      case JOB_EXECUTE_DIAGNOSTIC_REQUEST:
        return this.diagnosticsService.handleExecuteDiagnosticRequestJob(
          job.data as { requestId: string },
        );
      case JOB_GENERATE_DIAGNOSTIC_REPORT:
        return this.diagnosticsService.handleGenerateDiagnosticReportJob(
          job.data as { requestId: string; runId: string },
        );
      default:
        throw new Error(`Unsupported diagnostics job '${job.name}'.`);
    }
  }
}
