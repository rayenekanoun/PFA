import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  compactText,
  downloadReportPdf,
  formatDateTime,
  formatRelativeTime,
  statusTone,
  vehicleDisplayName,
} from './lib';
import type { AuthMode, DiagnosticDtc, DiagnosticMeasurement, SupportedPidRow } from './types';
import { useAppModel } from './useAppModel';

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${statusTone(status)}`}>{status.replaceAll('_', ' ')}</span>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-stack" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <span className="skeleton-row" key={`skeleton-${index}`} />
      ))}
    </div>
  );
}

function MeasurementGrid({ measurements }: { measurements: DiagnosticMeasurement[] }) {
  return (
    <div className="measurement-grid">
      {measurements.map((measurement) => (
        <article key={`${measurement.key}-${measurement.label}`}>
          <p>{measurement.label}</p>
          <strong>
            {String(measurement.value ?? 'n/a')}
            {measurement.unit ? ` ${measurement.unit}` : ''}
          </strong>
        </article>
      ))}
    </div>
  );
}

function DtcTable({ dtcs }: { dtcs: DiagnosticDtc[] }) {
  return (
    <div className="table-frame">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>System</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {dtcs.map((dtc) => (
            <tr key={`${dtc.code}-${dtc.system}`}>
              <td>{dtc.code}</td>
              <td>{dtc.system}</td>
              <td>{dtc.description || dtc.humanTitle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { authenticate, busy } = useAppModel();
  const [error, setError] = useState<string | null>(null);
  const registerMode = mode === 'register';

  async function handleSubmit(formData: FormData) {
    try {
      setError(null);
      await authenticate(
        mode,
        String(formData.get('email') ?? ''),
        String(formData.get('password') ?? ''),
        String(formData.get('displayName') ?? ''),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to authenticate.');
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-intro">
        <div className="brand-chip">Connected Vehicle Diagnostics</div>
        <h1>Operational workspace for diagnostic teams.</h1>
        <p>
          Manage vehicles, link hardware, run requests, and review structured reports in one enterprise interface.
        </p>
      </section>

      <section className="auth-card-wrap">
        <article className="auth-card">
          <div className="auth-switch">
            <Link className={registerMode ? '' : 'active'} to="/login">Login</Link>
            <Link className={registerMode ? 'active' : ''} to="/signup">Sign up</Link>
          </div>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit(new FormData(event.currentTarget));
            }}
          >
            <label>
              Email
              <input name="email" required type="email" />
            </label>

            {registerMode && (
              <label>
                Display name
                <input name="displayName" required type="text" />
              </label>
            )}

            <label>
              Password
              <input name="password" required type="password" />
            </label>

            {error && <p className="inline-error">{error}</p>}

            <button className="button primary" disabled={busy} type="submit">
              {busy ? 'Please wait...' : registerMode ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}

export function OverviewPage() {
  const { requests, vehicles } = useAppModel();
  const reports = requests.filter((item) => item.hasReport);
  const linkedDevices = vehicles.filter((item) => item.device).length;

  return (
    <div className="view-stack">
      <section className="kpi-strip">
        <article>
          <span>Total vehicles</span>
          <strong>{vehicles.length}</strong>
        </article>
        <article>
          <span>Devices linked</span>
          <strong>{linkedDevices}</strong>
        </article>
        <article>
          <span>Diagnostic requests</span>
          <strong>{requests.length}</strong>
        </article>
        <article>
          <span>Completed reports</span>
          <strong>{reports.length}</strong>
        </article>
      </section>

      <section className="panel">
        <header>
          <h2>Recent activity</h2>
          <span>{requests.length ? `${Math.min(8, requests.length)} latest requests` : 'No activity yet'}</span>
        </header>

        {!requests.length && (
          <EmptyState
            title="No diagnostic activity"
            body="Create your first diagnostic request in Conversations to start building execution history."
          />
        )}

        {!!requests.length && (
          <ul className="activity-list">
            {requests.slice(0, 8).map((request) => (
              <li key={request.id}>
                <div>
                  <strong>{compactText(request.complaintText, 110)}</strong>
                  <p>{vehicleDisplayName(request.vehicle)}</p>
                </div>
                <div className="activity-meta">
                  <StatusBadge status={request.status} />
                  <small>{formatRelativeTime(request.updatedAt || request.createdAt)}</small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>Recent reports</h2>
          <span>{reports.length} available</span>
        </header>

        {!reports.length && (
          <EmptyState
            title="No finalized reports"
            body="Reports appear here when a diagnostic request reaches completion."
          />
        )}

        {!!reports.length && (
          <ul className="report-list">
            {reports.slice(0, 6).map((request) => (
              <li key={request.id}>
                <div>
                  <strong>{compactText(request.complaintText, 95)}</strong>
                  <p>{vehicleDisplayName(request.vehicle)}</p>
                </div>
                <small>{formatDateTime(request.completedAt || request.updatedAt)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function CarsPage() {
  const {
    busy,
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    vehicleDraft,
    updateVehicleDraft,
    createVehicle,
  } = useAppModel();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        const searchTarget = `${vehicle.mqttCarId} ${vehicle.vin ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.toLowerCase();
        return searchTarget.includes(query.trim().toLowerCase());
      }),
    [query, vehicles],
  );

  const selected = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;

  return (
    <div className="split-layout">
      <section className="panel list-panel">
        <header>
          <h2>Vehicle list</h2>
          <button className="button primary" onClick={() => setShowCreate((value) => !value)} type="button">
            {showCreate ? 'Close' : 'Create car'}
          </button>
        </header>

        {showCreate && (
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void createVehicle();
            }}
          >
            <div className="field-row">
              <label>
                MQTT car ID
                <input
                  value={vehicleDraft.mqttCarId}
                  onChange={(event) => updateVehicleDraft('mqttCarId', event.target.value)}
                />
              </label>
              <label>
                VIN
                <input value={vehicleDraft.vin} onChange={(event) => updateVehicleDraft('vin', event.target.value)} />
              </label>
            </div>

            <div className="field-row">
              <label>
                Make
                <input value={vehicleDraft.make} onChange={(event) => updateVehicleDraft('make', event.target.value)} />
              </label>
              <label>
                Model
                <input value={vehicleDraft.model} onChange={(event) => updateVehicleDraft('model', event.target.value)} />
              </label>
              <label>
                Year
                <input value={vehicleDraft.year} onChange={(event) => updateVehicleDraft('year', event.target.value)} />
              </label>
            </div>

            <button className="button primary" disabled={busy} type="submit">Create vehicle</button>
          </form>
        )}

        <label className="search-input">
          Search vehicles
          <input placeholder="Search by VIN, MQTT ID, make, model" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>

        {!filtered.length && <EmptyState title="No vehicles found" body="Adjust filters or create a new vehicle." />}

        <div className="list-scroll">
          {filtered.map((vehicle) => (
            <button
              className={`list-item ${selectedVehicleId === vehicle.id ? 'selected' : ''}`}
              key={vehicle.id}
              onClick={() => setSelectedVehicleId(vehicle.id)}
              type="button"
            >
              <strong>{vehicleDisplayName(vehicle)}</strong>
              <p>{vehicle.vin || 'VIN unavailable'}</p>
              <small>{vehicle.mqttCarId}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel detail-panel">
        {!selected && (
          <EmptyState
            title="Select a vehicle"
            body="Choose a vehicle from the list to inspect registry and device linkage details."
          />
        )}

        {selected && (
          <>
            <header>
              <h2>{vehicleDisplayName(selected)}</h2>
              <StatusBadge status={selected.device?.status ?? 'NO_DEVICE'} />
            </header>

            <dl className="detail-grid">
              <div>
                <dt>MQTT car ID</dt>
                <dd>{selected.mqttCarId}</dd>
              </div>
              <div>
                <dt>VIN</dt>
                <dd>{selected.vin || 'Not provided'}</dd>
              </div>
              <div>
                <dt>Make / model</dt>
                <dd>{selected.make || '-'} {selected.model || '-'}</dd>
              </div>
              <div>
                <dt>Year</dt>
                <dd>{selected.year || 'Unknown'}</dd>
              </div>
              <div>
                <dt>Linked device</dt>
                <dd>{selected.device?.serialNumber || 'No linked device'}</dd>
              </div>
              <div>
                <dt>Created at</dt>
                <dd>{formatDateTime(selected.createdAt)}</dd>
              </div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}

function groupPids(rows: SupportedPidRow[]): Array<{ category: string; rows: SupportedPidRow[] }> {
  const grouped = new Map<string, SupportedPidRow[]>();
  for (const row of rows) {
    const category = row.pid.key.split('_')[0]?.toUpperCase() || 'GENERAL';
    const existing = grouped.get(category) ?? [];
    existing.push(row);
    grouped.set(category, existing);
  }
  return [...grouped.entries()].map(([category, entries]) => ({ category, rows: entries }));
}

export function DevicesPage() {
  const {
    vehicles,
    deviceDrafts,
    setDeviceDrafts,
    attachOrUpdateDevice,
    triggerCapabilityDiscovery,
    fetchSupportedPids,
    supportedByVehicle,
  } = useAppModel();
  const [queryByVehicle, setQueryByVehicle] = useState<Record<string, string>>({});

  if (!vehicles.length) {
    return <EmptyState title="No vehicles" body="Add cars first. Devices are managed per vehicle." />;
  }

  return (
    <div className="stack-layout">
      {vehicles.map((vehicle) => {
        const pidData = supportedByVehicle[vehicle.id];
        const search = (queryByVehicle[vehicle.id] ?? '').trim().toLowerCase();
        const supported = (pidData?.supportedPids ?? []).filter((row) => row.isSupported);
        const filtered = supported.filter((row) => {
          const target = `${row.pid.key} ${row.pid.label} ${row.pid.fullCode}`.toLowerCase();
          return target.includes(search);
        });
        const grouped = groupPids(filtered);

        return (
          <section className="panel" key={vehicle.id}>
            <header>
              <h2>{vehicleDisplayName(vehicle)}</h2>
              <StatusBadge status={vehicle.device?.status ?? 'NO_DEVICE'} />
            </header>

            <div className="device-grid">
              <div className="device-form">
                <div className="field-row">
                  <label>
                    Device serial
                    <input
                      value={deviceDrafts[vehicle.id]?.serialNumber ?? vehicle.device?.serialNumber ?? ''}
                      onChange={(event) =>
                        setDeviceDrafts((current) => ({
                          ...current,
                          [vehicle.id]: {
                            serialNumber: event.target.value,
                            firmwareVersion: current[vehicle.id]?.firmwareVersion ?? vehicle.device?.firmwareVersion ?? '',
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Firmware
                    <input
                      value={deviceDrafts[vehicle.id]?.firmwareVersion ?? vehicle.device?.firmwareVersion ?? ''}
                      onChange={(event) =>
                        setDeviceDrafts((current) => ({
                          ...current,
                          [vehicle.id]: {
                            serialNumber: current[vehicle.id]?.serialNumber ?? vehicle.device?.serialNumber ?? '',
                            firmwareVersion: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="action-row">
                  <button className="button primary" onClick={() => void attachOrUpdateDevice(vehicle.id)} type="button">
                    Attach or update
                  </button>
                  <button className="button ghost" onClick={() => void triggerCapabilityDiscovery(vehicle.id)} type="button">
                    Trigger discovery
                  </button>
                  <button className="button ghost" onClick={() => void fetchSupportedPids(vehicle.id)} type="button">
                    Load supported PIDs
                  </button>
                </div>

                <dl className="inline-meta">
                  <div>
                    <dt>Last sync</dt>
                    <dd>{formatDateTime(vehicle.device?.lastSeenAt)}</dd>
                  </div>
                  <div>
                    <dt>Discovery</dt>
                    <dd>{formatDateTime(vehicle.device?.capabilitiesDiscoveredAt)}</dd>
                  </div>
                </dl>
              </div>

              <div className="pid-panel">
                <header>
                  <h3>Supported signals</h3>
                  <span>{filtered.length} loaded</span>
                </header>

                <label className="search-input">
                  Search signals
                  <input
                    placeholder="Filter by key or code"
                    value={queryByVehicle[vehicle.id] ?? ''}
                    onChange={(event) =>
                      setQueryByVehicle((current) => ({
                        ...current,
                        [vehicle.id]: event.target.value,
                      }))
                    }
                  />
                </label>

                {!pidData && (
                  <EmptyState
                    title="No supported PID data"
                    body="Trigger capability discovery, then load supported PIDs for this vehicle."
                  />
                )}

                {!!pidData && !filtered.length && (
                  <EmptyState title="No matching signals" body="Try a broader search query." />
                )}

                {!!filtered.length && (
                  <div className="pid-groups">
                    {grouped.map((group) => (
                      <section key={group.category}>
                        <h4>{group.category}</h4>
                        <div className="table-frame">
                          <table>
                            <thead>
                              <tr>
                                <th>Key</th>
                                <th>Label</th>
                                <th>Code</th>
                                <th>Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.rows.map((row) => (
                                <tr key={row.id}>
                                  <td>{row.pid.key}</td>
                                  <td>{row.pid.label}</td>
                                  <td>{row.pid.fullCode}</td>
                                  <td>{row.pid.unit || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ConversationsPage() {
  const {
    vehicles,
    requests,
    selectedRequestId,
    setSelectedRequestId,
    selectedVehicleId,
    setSelectedVehicleId,
    complaintText,
    setComplaintText,
    createDiagnosticRequest,
    requestDetail,
    reportDetail,
    detailLoading,
  } = useAppModel();

  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null;

  return (
    <div className="conversation-layout">
      <aside className="panel request-list-panel">
        <header>
          <h2>Diagnostic requests</h2>
          <span>{requests.length}</span>
        </header>

        {!requests.length && (
          <EmptyState
            title="No requests"
            body="Create a diagnostic request from the composer to initialize this queue."
          />
        )}

        <div className="list-scroll">
          {requests.map((request) => (
            <button
              className={`list-item ${selectedRequestId === request.id ? 'selected' : ''}`}
              key={request.id}
              onClick={() => setSelectedRequestId(request.id)}
              type="button"
            >
              <div className="item-head">
                <StatusBadge status={request.status} />
                <small>{formatRelativeTime(request.updatedAt || request.createdAt)}</small>
              </div>
              <strong>{compactText(request.complaintText, 86)}</strong>
              <p>{vehicleDisplayName(request.vehicle)}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="panel thread-panel">
        <header>
          <h2>Conversation thread</h2>
          {selectedRequest && <StatusBadge status={selectedRequest.status} />}
        </header>

        {!selectedRequest && (
          <EmptyState title="No conversation selected" body="Pick a request from the left panel or create a new one." />
        )}

        {detailLoading && <SkeletonRows count={5} />}

        {!!selectedRequest && !detailLoading && (
          <div className="thread-stack">
            <article className="thread-block user">
              <small>Complaint</small>
              <p>{selectedRequest.complaintText}</p>
              <span>{formatDateTime(selectedRequest.createdAt)}</span>
            </article>

            <article className="thread-block system">
              <small>Classification</small>
              <p>{requestDetail?.profile?.name || 'Awaiting classification'}</p>
              {requestDetail?.profile?.rationale && <span>{requestDetail.profile.rationale}</span>}
            </article>

            <article className="thread-block system">
              <small>Run status</small>
              <p>{requestDetail?.latestRun?.status || selectedRequest.status}</p>
            </article>

            {!!requestDetail?.latestRun?.measurements.length && (
              <article className="thread-block system">
                <small>Measurements</small>
                <MeasurementGrid measurements={requestDetail.latestRun.measurements} />
              </article>
            )}

            {!!requestDetail?.latestRun?.dtcs.length && (
              <article className="thread-block system">
                <small>DTCs</small>
                <DtcTable dtcs={requestDetail.latestRun.dtcs} />
              </article>
            )}

            {reportDetail && (
              <article className="thread-block system">
                <small>Report preview</small>
                <p>{reportDetail.reportJson.summary}</p>
                <button
                  className="button ghost"
                  onClick={() => downloadReportPdf(reportDetail, selectedRequest)}
                  type="button"
                >
                  Download PDF
                </button>
              </article>
            )}
          </div>
        )}

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void createDiagnosticRequest();
          }}
        >
          <div className="field-row">
            <label>
              Vehicle
              <select value={selectedVehicleId} onChange={(event) => setSelectedVehicleId(event.target.value)}>
                <option value="" disabled>Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicleDisplayName(vehicle)}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Complaint
            <textarea
              placeholder="Describe the observed issue and conditions."
              rows={4}
              value={complaintText}
              onChange={(event) => setComplaintText(event.target.value)}
            />
          </label>

          <div className="composer-foot">
            <p>Creates a backend diagnostic request and starts execution workflow.</p>
            <button className="button primary" type="submit">Submit request</button>
          </div>
        </form>
      </section>

      <aside className="panel metadata-panel">
        <header>
          <h2>Request metadata</h2>
        </header>

        {!selectedRequest && (
          <EmptyState title="No metadata" body="Select a request to inspect vehicle and processing details." />
        )}

        {!!selectedRequest && (
          <dl className="detail-grid">
            <div>
              <dt>Request ID</dt>
              <dd>{selectedRequest.id}</dd>
            </div>
            <div>
              <dt>Vehicle</dt>
              <dd>{vehicleDisplayName(selectedRequest.vehicle)}</dd>
            </div>
            <div>
              <dt>MQTT car ID</dt>
              <dd>{selectedRequest.vehicle.mqttCarId}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(selectedRequest.createdAt)}</dd>
            </div>
            <div>
              <dt>Last update</dt>
              <dd>{formatDateTime(selectedRequest.updatedAt)}</dd>
            </div>
            <div>
              <dt>Latest run ID</dt>
              <dd>{selectedRequest.latestRun?.id || '-'}</dd>
            </div>
            <div>
              <dt>Profile</dt>
              <dd>{selectedRequest.profile?.name || '-'}</dd>
            </div>
          </dl>
        )}
      </aside>
    </div>
  );
}

export function ReportsPage() {
  const { requests, selectedRequestId, setSelectedRequestId, reportDetail } = useAppModel();
  const reports = requests.filter((request) => request.hasReport);
  const selectedRequest = reports.find((request) => request.id === selectedRequestId) ?? null;

  return (
    <div className="split-layout">
      <section className="panel list-panel">
        <header>
          <h2>Report list</h2>
          <span>{reports.length}</span>
        </header>

        {!reports.length && (
          <EmptyState title="No reports available" body="Reports appear here after completed diagnostic runs." />
        )}

        <div className="list-scroll">
          {reports.map((request) => (
            <button
              className={`list-item ${selectedRequestId === request.id ? 'selected' : ''}`}
              key={request.id}
              onClick={() => setSelectedRequestId(request.id)}
              type="button"
            >
              <strong>{compactText(request.complaintText, 88)}</strong>
              <p>{vehicleDisplayName(request.vehicle)}</p>
              <small>{formatDateTime(request.completedAt || request.updatedAt)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel detail-panel report-detail">
        {!reportDetail && <EmptyState title="Select a report" body="Choose a report from the list to read full output and export PDF." />}

        {!!reportDetail && (
          <>
            <header>
              <h2>Report viewer</h2>
              <button
                className="button primary"
                onClick={() => downloadReportPdf(reportDetail, selectedRequest)}
                type="button"
              >
                Download PDF
              </button>
            </header>

            <article className="report-section">
              <h3>Summary</h3>
              <p>{reportDetail.reportJson.summary}</p>
            </article>

            <div className="report-grid">
              <article className="report-section">
                <h3>Possible causes</h3>
                <ul>
                  {reportDetail.reportJson.possibleCauses.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="report-section">
                <h3>Recommendations</h3>
                <ul>
                  {reportDetail.reportJson.nextSteps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>

            <article className="report-section">
              <h3>Caveats</h3>
              <ul>
                {reportDetail.reportJson.caveats.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="report-section">
              <h3>Confidence</h3>
              <p>{Math.round(reportDetail.reportJson.confidence * 100)}%</p>
            </article>
          </>
        )}
      </section>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="view-stack">
      <section className="panel">
        <header>
          <h2>Settings</h2>
          <span>Minimal placeholder</span>
        </header>
        <p className="muted-body">
          Settings are intentionally minimal in this phase. Authentication and operational pages are prioritized.
        </p>
      </section>
    </div>
  );
}
