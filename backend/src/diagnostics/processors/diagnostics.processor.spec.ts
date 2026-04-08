import {
  JOB_DISCOVER_VEHICLE_CAPABILITIES,
  JOB_EXECUTE_DIAGNOSTIC_REQUEST,
  JOB_GENERATE_DIAGNOSTIC_REPORT,
} from '../../common/queue.constants';
import { DiagnosticsService } from '../diagnostics.service';
import { DiagnosticsProcessor } from './diagnostics.processor';

describe('DiagnosticsProcessor', () => {
  const diagnosticsServiceMock = {
    handleCapabilityDiscoveryJob: jest.fn(),
    handleExecuteDiagnosticRequestJob: jest.fn(),
    handleGenerateDiagnosticReportJob: jest.fn(),
  };

  const processor = new DiagnosticsProcessor(diagnosticsServiceMock as unknown as DiagnosticsService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes capability discovery job to the right handler', async () => {
    diagnosticsServiceMock.handleCapabilityDiscoveryJob.mockResolvedValue({ ok: true });

    await processor.process({
      name: JOB_DISCOVER_VEHICLE_CAPABILITIES,
      data: { vehicleId: 'veh-1' },
    } as never);

    expect(diagnosticsServiceMock.handleCapabilityDiscoveryJob).toHaveBeenCalledWith({
      vehicleId: 'veh-1',
    });
  });

  it('routes execution and report jobs to the right handlers', async () => {
    diagnosticsServiceMock.handleExecuteDiagnosticRequestJob.mockResolvedValue({ ok: true });
    diagnosticsServiceMock.handleGenerateDiagnosticReportJob.mockResolvedValue({ ok: true });

    await processor.process({
      name: JOB_EXECUTE_DIAGNOSTIC_REQUEST,
      data: { requestId: 'req-1' },
    } as never);
    await processor.process({
      name: JOB_GENERATE_DIAGNOSTIC_REPORT,
      data: { requestId: 'req-1', runId: 'run-1' },
    } as never);

    expect(diagnosticsServiceMock.handleExecuteDiagnosticRequestJob).toHaveBeenCalledWith({
      requestId: 'req-1',
    });
    expect(diagnosticsServiceMock.handleGenerateDiagnosticReportJob).toHaveBeenCalledWith({
      requestId: 'req-1',
      runId: 'run-1',
    });
  });

  it('throws for unsupported job name', async () => {
    await expect(
      processor.process({
        name: 'unknown_job',
        data: {},
      } as never),
    ).rejects.toThrow("Unsupported diagnostics job 'unknown_job'.");
  });
});
