import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type UserRole = 'ADMIN' | 'USER';

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface Vehicle {
  id: string;
  mqttCarId: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  createdAt: string;
}

interface DiagnosticRequestSummary {
  id: string;
  complaintText: string;
  status: string;
  createdAt: string;
  profile: { code: string; name: string } | null;
  vehicle: {
    id: string;
    mqttCarId: string;
    vin: string | null;
  };
  hasReport: boolean;
}

interface DiagnosticRequestDetail {
  requestId: string;
  status: string;
  complaintText: string;
  createdAt: string;
  vehicle: {
    id: string;
    mqttCarId: string;
    vin: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
  };
  profile: {
    code: string;
    name: string;
    description: string | null;
    confidence: number | null;
    rationale: string | null;
  } | null;
  plan: {
    includeDtcs: boolean;
    requestedMeasurements: Array<{ key: string; mode: string; pid: string }>;
    plannerNotes: string | null;
  } | null;
  latestRun: {
    id: string;
    status: string;
    errorMessage: string | null;
    measurements: Array<{
      key: string;
      label: string;
      value: number | string | boolean | Record<string, unknown> | null;
      unit: string | null;
      status: string;
    }>;
    dtcs: Array<{
      code: string;
      description: string;
      severity: string | null;
      state: string;
      system: string;
      humanTitle: string;
      humanExplanation: string;
    }>;
  } | null;
  report: {
    summary: string | null;
    reportText: string;
  } | null;
}

interface SupportedPidResponse {
  vehicleId: string;
  lastDiscoveryAt: string | null;
  supportedPids: Array<{
    id: string;
    isSupported: boolean;
    checkedAt: string;
    pid: {
      key: string;
      label: string;
      fullCode: string;
      unit: string | null;
    };
  }>;
}

interface ReportResponse {
  id: string;
  requestId: string;
  runId: string;
  reportJson: {
    summary: string;
    possibleCauses: string[];
    nextSteps: string[];
    caveats: string[];
    confidence: number;
  };
  reportText: string;
  createdAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const AUTH_STORAGE_KEY = 'connected-car-auth-state';

class ApiError extends Error {
  public readonly status: number;
  public readonly payload: unknown;

  public constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function readStoredAuth(): AuthResponse | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthResponse;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractErrorMessage(parsedPayload: unknown, fallbackStatus: number): string {
  const typedPayload = parsedPayload as { message?: string | string[]; error?: string } | null;
  const message =
    typedPayload?.message ??
    typedPayload?.error ??
    `Request failed with status ${fallbackStatus}`;

  if (Array.isArray(message)) {
    return message.join(', ');
  }
  return String(message);
}

async function apiRequest<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, ...requestOptions } = options;
  const headers = new Headers(options.headers ?? {});
  if (!headers.has('Content-Type') && requestOptions.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers,
  });

  const payloadText = await response.text();
  let parsedPayload: unknown = {};
  if (payloadText) {
    try {
      parsedPayload = JSON.parse(payloadText);
    } catch {
      parsedPayload = payloadText;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, parsedPayload, extractErrorMessage(parsedPayload, response.status));
  }

  return parsedPayload as T;
}

function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(() => readStoredAuth());
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<DiagnosticRequestSummary[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [requestDetail, setRequestDetail] = useState<DiagnosticRequestDetail | null>(null);
  const [reportDetail, setReportDetail] = useState<ReportResponse | null>(null);

  const [mqttCarId, setMqttCarId] = useState('');
  const [vin, setVin] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  const [deviceForms, setDeviceForms] = useState<Record<string, { serialNumber: string; firmwareVersion: string }>>(
    {},
  );
  const [supportedByVehicle, setSupportedByVehicle] = useState<Record<string, SupportedPidResponse>>({});

  const [complaintText, setComplaintText] = useState('');

  useEffect(() => {
    if (auth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [auth]);

  const signedIn = !!auth;

  const requestWithAuth = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      if (!auth) {
        throw new Error('You need to sign in first.');
      }

      try {
        return await apiRequest<T>(path, {
          ...options,
          accessToken: auth.accessToken,
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        const refreshedAuth = await apiRequest<AuthResponse>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({
            refreshToken: auth.refreshToken,
          }),
        });
        setAuth(refreshedAuth);

        return apiRequest<T>(path, {
          ...options,
          accessToken: refreshedAuth.accessToken,
        });
      }
    },
    [auth],
  );

  const refreshVehicles = useCallback(async () => {
    if (!signedIn) {
      return;
    }

    const data = await requestWithAuth<Vehicle[]>('/vehicles');
    setVehicles(data);

    setSelectedVehicleId((previousSelectedId) => {
      if (data.length === 0) {
        return '';
      }
      if (previousSelectedId && data.some((vehicle) => vehicle.id === previousSelectedId)) {
        return previousSelectedId;
      }
      return data[0].id;
    });
  }, [requestWithAuth, signedIn]);

  const refreshRequests = useCallback(async () => {
    if (!signedIn) {
      return;
    }

    const data = await requestWithAuth<DiagnosticRequestSummary[]>('/diagnostic-requests');
    setRequests(data);
  }, [requestWithAuth, signedIn]);

  useEffect(() => {
    if (!signedIn) {
      setVehicles([]);
      setRequests([]);
      setSelectedVehicleId('');
      setSelectedRequestId('');
      setRequestDetail(null);
      setReportDetail(null);
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        await requestWithAuth<AuthUser>('/auth/me');
        await Promise.all([refreshVehicles(), refreshRequests()]);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setAuth(null);
        setFeedback(error instanceof Error ? error.message : 'Session expired. Please sign in again.');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [signedIn, requestWithAuth, refreshVehicles, refreshRequests]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [selectedVehicleId, vehicles],
  );

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [selectedRequestId, requests],
  );

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const payload =
        authMode === 'register'
          ? await apiRequest<AuthResponse>('/auth/register', {
              method: 'POST',
              body: JSON.stringify({
                email,
                displayName,
                password,
              }),
            })
          : await apiRequest<AuthResponse>('/auth/login', {
              method: 'POST',
              body: JSON.stringify({
                email,
                password,
              }),
            });

      setAuth(payload);
      setFeedback(`Welcome ${payload.user.displayName}.`);
      setPassword('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    setAuth(null);
    setFeedback('Signed out.');
  }

  async function handleCreateVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signedIn) return;

    setBusy(true);
    setFeedback(null);
    try {
      const created = await requestWithAuth<Vehicle>(
        '/vehicles',
        {
          method: 'POST',
          body: JSON.stringify({
            mqttCarId,
            vin: vin || undefined,
            make: make || undefined,
            model: model || undefined,
            year: year ? Number(year) : undefined,
          }),
        },
      );
      setFeedback(`Vehicle ${created.mqttCarId} created.`);
      setMqttCarId('');
      setVin('');
      setMake('');
      setModel('');
      setYear('');
      await refreshVehicles();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Vehicle creation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAttachDevice(vehicleId: string) {
    if (!signedIn) return;
    const deviceForm = deviceForms[vehicleId];
    if (!deviceForm?.serialNumber) {
      setFeedback('Please enter a serial number before attaching the device.');
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      await requestWithAuth<{ capabilityDiscoveryJobId: string }>(
        `/vehicles/${vehicleId}/devices`,
        {
          method: 'POST',
          body: JSON.stringify({
            serialNumber: deviceForm.serialNumber,
            firmwareVersion: deviceForm.firmwareVersion || undefined,
          }),
        },
      );
      setFeedback('Device linked and capability discovery queued.');
      await refreshVehicles();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Device attach failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscoverCapabilities(vehicleId: string) {
    if (!signedIn) return;
    setBusy(true);
    setFeedback(null);
    try {
      await requestWithAuth<{ status: string }>(
        `/vehicles/${vehicleId}/discover-capabilities`,
        { method: 'POST' },
      );
      setFeedback('Capability discovery job queued.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Capability discovery failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadSupportedPids(vehicleId: string) {
    if (!signedIn) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await requestWithAuth<SupportedPidResponse>(
        `/vehicles/${vehicleId}/supported-pids`,
      );
      setSupportedByVehicle((previous) => ({ ...previous, [vehicleId]: response }));
      const supportedCount = response.supportedPids.filter((entry) => entry.isSupported).length;
      setFeedback(`Loaded capability matrix (${supportedCount} supported PID entries).`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to load supported PID matrix.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateDiagnosticRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signedIn || !selectedVehicleId) {
      setFeedback('Select a vehicle first.');
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const body = {
        vehicleId: selectedVehicleId,
        complaintText,
      };

      const result = await requestWithAuth<{ requestId: string; status: string; pollingUrl: string }>(
        '/diagnostic-requests',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );
      setFeedback(`Diagnostic request queued (${result.requestId}).`);
      setComplaintText('');
      setSelectedRequestId(result.requestId);
      await refreshRequests();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Diagnostic request creation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadRequestDetail(requestId: string) {
    if (!signedIn) return;
    setBusy(true);
    setFeedback(null);
    try {
      const detail = await requestWithAuth<DiagnosticRequestDetail>(
        `/diagnostic-requests/${requestId}`,
      );
      setRequestDetail(detail);
      setSelectedRequestId(requestId);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to load request detail.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadReport(requestId: string) {
    if (!signedIn) return;
    setBusy(true);
    setFeedback(null);
    try {
      const report = await requestWithAuth<ReportResponse>(`/reports/${requestId}`);
      setReportDetail(report);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Report is not ready yet.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Connected Car Diagnostics</p>
          <h1>Backend Control Console</h1>
          <p className="hero-copy">
            This frontend consumes your live NestJS APIs for auth, vehicles, capability discovery, diagnostics, and
            reports.
          </p>
        </div>
        <div className="hero-meta">
          <span className="chip">API: {API_BASE_URL}</span>
          <span className={`chip ${signedIn ? 'chip-ok' : 'chip-off'}`}>
            {signedIn ? `Signed in as ${auth?.user.displayName}` : 'Signed out'}
          </span>
        </div>
      </header>

      {feedback && <p className="feedback">{feedback}</p>}

      <main className="dashboard-grid">
        <section className="panel">
          <h2>Auth</h2>
          {!signedIn ? (
            <form className="stack-form" onSubmit={handleAuthSubmit}>
              <div className="mode-toggle">
                <button
                  type="button"
                  className={authMode === 'register' ? 'active' : ''}
                  onClick={() => setAuthMode('register')}
                >
                  Register
                </button>
                <button
                  type="button"
                  className={authMode === 'login' ? 'active' : ''}
                  onClick={() => setAuthMode('login')}
                >
                  Login
                </button>
              </div>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {authMode === 'register' && (
                <label>
                  Display Name
                  <input
                    required
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </label>
              )}
              <label>
                Password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button disabled={busy} type="submit">
                {busy ? 'Working...' : authMode === 'register' ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          ) : (
            <div className="auth-card">
              <p>
                <strong>{auth.user.displayName}</strong>
              </p>
              <p>{auth.user.email}</p>
              <p>Role: {auth.user.role}</p>
              <button onClick={handleLogout}>Sign Out</button>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Vehicles</h2>
          <form className="stack-form" onSubmit={handleCreateVehicle}>
            <label>
              MQTT Car ID
              <input
                required
                placeholder="sim-demo"
                value={mqttCarId}
                onChange={(event) => setMqttCarId(event.target.value)}
              />
            </label>
            <label>
              VIN
              <input value={vin} onChange={(event) => setVin(event.target.value)} />
            </label>
            <div className="split">
              <label>
                Make
                <input value={make} onChange={(event) => setMake(event.target.value)} />
              </label>
              <label>
                Model
                <input value={model} onChange={(event) => setModel(event.target.value)} />
              </label>
            </div>
            <label>
              Year
              <input value={year} onChange={(event) => setYear(event.target.value)} />
            </label>
            <button disabled={busy || !signedIn} type="submit">
              Create Vehicle
            </button>
          </form>

          <div className="scroll-list">
            {vehicles.map((vehicle) => {
              const supported = supportedByVehicle[vehicle.id];
              const deviceForm = deviceForms[vehicle.id] ?? {
                serialNumber: '',
                firmwareVersion: '',
              };

              return (
                <article
                  className={`list-card ${selectedVehicleId === vehicle.id ? 'selected' : ''}`}
                  key={vehicle.id}
                >
                  <button
                    className="select-button"
                    onClick={() => setSelectedVehicleId(vehicle.id)}
                    type="button"
                  >
                    {vehicle.mqttCarId}
                  </button>
                  <p>{vehicle.vin ?? 'No VIN yet'}</p>
                  <div className="split">
                    <input
                      placeholder="Device Serial"
                      value={deviceForm.serialNumber}
                      onChange={(event) =>
                        setDeviceForms((previous) => ({
                          ...previous,
                          [vehicle.id]: {
                            ...deviceForm,
                            serialNumber: event.target.value,
                          },
                        }))
                      }
                    />
                    <input
                      placeholder="FW Version"
                      value={deviceForm.firmwareVersion}
                      onChange={(event) =>
                        setDeviceForms((previous) => ({
                          ...previous,
                          [vehicle.id]: {
                            ...deviceForm,
                            firmwareVersion: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="action-row">
                    <button type="button" onClick={() => void handleAttachDevice(vehicle.id)}>
                      Attach Device
                    </button>
                    <button type="button" onClick={() => void handleDiscoverCapabilities(vehicle.id)}>
                      Discover
                    </button>
                    <button type="button" onClick={() => void handleLoadSupportedPids(vehicle.id)}>
                      Supported PIDs
                    </button>
                  </div>
                  {supported && (
                    <p className="hint">
                      Supported: {supported.supportedPids.filter((entry) => entry.isSupported).length} /{' '}
                      {supported.supportedPids.length}
                    </p>
                  )}
                </article>
              );
            })}
            {vehicles.length === 0 && <p className="hint">No vehicles yet.</p>}
          </div>
        </section>

        <section className="panel">
          <h2>Diagnostics</h2>
          <form className="stack-form" onSubmit={handleCreateDiagnosticRequest}>
            <label>
              Vehicle
              <select
                value={selectedVehicleId}
                onChange={(event) => setSelectedVehicleId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Select vehicle
                </option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.mqttCarId}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Complaint
              <textarea
                required
                rows={3}
                placeholder="My car consumes too much gasoline."
                value={complaintText}
                onChange={(event) => setComplaintText(event.target.value)}
              />
            </label>
            <p className="hint">
              AI classification/reporting uses your configured provider. Device values come from the MQTT simulator
              until hardware is connected.
            </p>
            <button disabled={busy || !selectedVehicle} type="submit">
              Create Diagnostic Request
            </button>
          </form>

          <div className="action-row top-gap">
            <button type="button" onClick={() => void refreshRequests()} disabled={!signedIn}>
              Refresh Requests
            </button>
            <button
              type="button"
              onClick={() => (selectedRequestId ? void handleLoadRequestDetail(selectedRequestId) : undefined)}
              disabled={!selectedRequestId}
            >
              Refresh Selected Detail
            </button>
          </div>

          <div className="scroll-list">
            {requests.map((request) => (
              <article
                className={`list-card ${selectedRequestId === request.id ? 'selected' : ''}`}
                key={request.id}
              >
                <button
                  className="select-button"
                  onClick={() => {
                    setSelectedRequestId(request.id);
                    void handleLoadRequestDetail(request.id);
                  }}
                  type="button"
                >
                  {request.id.slice(0, 8)}... {request.status}
                </button>
                <p>{request.complaintText}</p>
                <p>
                  Vehicle: <strong>{request.vehicle.mqttCarId}</strong>
                </p>
                <p>Profile: {request.profile?.code ?? 'pending'}</p>
                <div className="action-row">
                  <button type="button" onClick={() => void handleLoadRequestDetail(request.id)}>
                    Details
                  </button>
                  <button type="button" onClick={() => void handleLoadReport(request.id)}>
                    Report
                  </button>
                </div>
              </article>
            ))}
            {requests.length === 0 && <p className="hint">No diagnostic requests yet.</p>}
          </div>
        </section>

        <section className="panel panel-wide">
          <h2>Request Detail And Report</h2>
          {selectedRequest && (
            <p className="hint">
              Selected request: <strong>{selectedRequest.id}</strong> on vehicle{' '}
              <strong>{selectedRequest.vehicle.mqttCarId}</strong>
            </p>
          )}

          {requestDetail ? (
            <div className="detail-grid">
              <div className="detail-card">
                <h3>Summary</h3>
                <p>Status: {requestDetail.status}</p>
                <p>Complaint: {requestDetail.complaintText}</p>
                <p>
                  Profile: {requestDetail.profile?.name ?? 'pending'}{' '}
                  {requestDetail.profile?.confidence != null
                    ? `(${Math.round(requestDetail.profile.confidence * 100)}%)`
                    : ''}
                </p>
                {requestDetail.profile?.description && <p>{requestDetail.profile.description}</p>}
                <p>Vehicle: {requestDetail.vehicle.mqttCarId}</p>
              </div>

              <div className="detail-card">
                <h3>Measurements</h3>
                {requestDetail.latestRun?.measurements.length ? (
                  <ul className="tight-list">
                    {requestDetail.latestRun.measurements.map((measurement) => (
                      <li key={`${requestDetail.latestRun?.id}-${measurement.key}`}>
                        <strong>{measurement.label}</strong>: {String(measurement.value ?? 'n/a')}{' '}
                        {measurement.unit ?? ''} ({measurement.status})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">No measurements yet.</p>
                )}
              </div>

              <div className="detail-card">
                <h3>DTCs</h3>
                {requestDetail.latestRun?.dtcs.length ? (
                  <ul className="tight-list">
                    {requestDetail.latestRun.dtcs.map((dtc) => (
                      <li key={dtc.code}>
                        <strong>{dtc.code}</strong>: {dtc.humanTitle} ({dtc.state})
                        <br />
                        <span>{dtc.humanExplanation}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">No DTCs captured in this run.</p>
                )}
              </div>

              <div className="detail-card">
                <h3>Supported PIDs Snapshot</h3>
                {selectedVehicle ? (
                  supportedByVehicle[selectedVehicle.id] ? (
                    <ul className="tight-list">
                      {supportedByVehicle[selectedVehicle.id].supportedPids
                        .filter((entry) => entry.isSupported)
                        .slice(0, 10)
                        .map((entry) => (
                          <li key={entry.id}>
                            <strong>{entry.pid.fullCode}</strong> {entry.pid.label}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="hint">Load supported PIDs from the Vehicles panel.</p>
                  )
                ) : (
                  <p className="hint">Select a vehicle first.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="hint">Select a request to inspect details.</p>
          )}

          {reportDetail && (
            <article className="report-card">
              <h3>Final Report</h3>
              <p>{reportDetail.reportJson.summary}</p>
              <h4>Possible Causes</h4>
              <ul className="tight-list">
                {reportDetail.reportJson.possibleCauses.map((cause) => (
                  <li key={cause}>{cause}</li>
                ))}
              </ul>
              <h4>Next Steps</h4>
              <ul className="tight-list">
                {reportDetail.reportJson.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="hint">Confidence: {Math.round(reportDetail.reportJson.confidence * 100)}%</p>
            </article>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
