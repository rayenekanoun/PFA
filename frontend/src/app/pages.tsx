import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  compactText,
  downloadReportPdf,
  formatDateTime,
  formatRelativeTime,
  statusTone,
  vehicleDisplayName,
} from "./lib";
import type {
  AuthMode,
  DiagnosticDtc,
  DiagnosticMeasurement,
  SupportedPidRow,
} from "./types";
import { useAppModel } from "./useAppModel";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge ${statusTone(status)}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        style={{ color: "var(--text-muted)", margin: "0 auto 4px" }}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
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
      {measurements.map((m) => (
        <article key={`${m.key}-${m.label}`}>
          <p>{m.label}</p>
          <strong>
            {String(m.value ?? "n/a")}
            {m.unit ? ` ${m.unit}` : ""}
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
              <td style={{ fontFamily: "DM Mono, monospace", color: "var(--accent)" }}>
                {dtc.code}
              </td>
              <td>{dtc.system}</td>
              <td>{dtc.description || dtc.humanTitle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── AUTH PAGE ─────────────────────────────────────────── */
export function AuthPage({ mode }: { mode: AuthMode }) {
  const { authenticate, busy } = useAppModel();
  const [error, setError] = useState<string | null>(null);
  const registerMode = mode === "register";

  async function handleSubmit(formData: FormData) {
    try {
      setError(null);
      await authenticate(
        mode,
        String(formData.get("email") ?? ""),
        String(formData.get("password") ?? ""),
        String(formData.get("displayName") ?? ""),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate.");
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-intro">
        <div className="auth-brand-row">
          <div className="auth-brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
              <path d="M12 12L2 7M12 12l10-5M12 12v10" />
            </svg>
          </div>
          <div>
            <div className="auth-brand-name">DiagOps</div>
            <div className="auth-brand-sub">Connected Vehicle Platform</div>
          </div>
        </div>

        <h1>Enterprise diagnostics for connected fleets.</h1>

        <p>
          Manage vehicles, link OBD hardware, run diagnostic workflows, and generate
          structured reports in one unified operator interface.
        </p>

        <div className="auth-feature-list">
          {[
            "Real-time OBD signal monitoring",
            "AI-powered diagnostic classification",
            "Automated report generation",
            "Multi-vehicle fleet management",
          ].map((feature) => (
            <div className="auth-feature-item" key={feature}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8l3.5 3.5L13 4" />
              </svg>
              {feature}
            </div>
          ))}
        </div>
      </section>

      <section className="auth-card-wrap">
        <article className="auth-card">
          <div className="auth-switch">
            <Link className={registerMode ? "" : "active"} to="/login">Sign in</Link>
            <Link className={registerMode ? "active" : ""} to="/signup">Create account</Link>
          </div>

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(new FormData(e.currentTarget));
            }}
          >
            <label>
              Email address
              <input name="email" required type="email" placeholder="you@company.com" />
            </label>

            {registerMode && (
              <label>
                Display name
                <input name="displayName" required type="text" placeholder="Your name" />
              </label>
            )}

            <label>
              Password
              <input name="password" required type="password" placeholder="••••••••" />
            </label>

            {error && <p className="inline-error">{error}</p>}

            <button className="button primary" disabled={busy} type="submit" style={{ marginTop: 4, padding: "10px 14px" }}>
              {busy ? "Please wait…" : registerMode ? "Create account" : "Sign in"}
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}

/* ─── OVERVIEW PAGE ─────────────────────────────────────── */
export function OverviewPage() {
  const { requests, vehicles } = useAppModel();
  const reports = requests.filter((r) => r.hasReport);
  const linkedDevices = vehicles.filter((v) => v.device).length;

  const kpis = [
    {
      label: "Total Vehicles",
      value: vehicles.length,
      colorClass: "cyan",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 10l2-5h10l2 5" />
          <rect x="2" y="10" width="16" height="5" rx="1.5" />
          <circle cx="5.5" cy="15.5" r="1.5" />
          <circle cx="14.5" cy="15.5" r="1.5" />
        </svg>
      ),
    },
    {
      label: "Devices Linked",
      value: linkedDevices,
      colorClass: "green",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3" y="4" width="14" height="12" rx="2" />
          <circle cx="10" cy="10" r="2.5" />
          <path d="M10 4v2M10 14v2M3 10h2M15 10h2" />
        </svg>
      ),
    },
    {
      label: "Diagnostic Requests",
      value: requests.length,
      colorClass: "orange",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 4h14v10H3z" />
          <path d="M6 16l4 2 4-2" />
          <path d="M6 8h8M6 11h5" />
        </svg>
      ),
    },
    {
      label: "Completed Reports",
      value: reports.length,
      colorClass: "purple",
      icon: (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M5 2h7l4 4v13H5V2z" />
          <path d="M12 2v4h4" />
          <path d="M7 9h6M7 12h6M7 15h3" />
        </svg>
      ),
    },
  ];

  return (
    <div className="view-stack">
      <section className="kpi-strip">
        {kpis.map((kpi) => (
          <article className="kpi-card" key={kpi.label}>
            <div className={`kpi-card-icon ${kpi.colorClass}`}>{kpi.icon}</div>
            <div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-label">{kpi.label}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <header>
          <h2>Recent Activity</h2>
          <span>
            {requests.length
              ? `${Math.min(8, requests.length)} of ${requests.length} requests`
              : "No activity yet"}
          </span>
        </header>

        {!requests.length && (
          <EmptyState
            title="No diagnostic activity"
            body="Create your first diagnostic request in Diagnostics to start building execution history."
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
          <h2>Recent Reports</h2>
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

/* ─── CARS PAGE ─────────────────────────────────────────── */
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
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(
    () =>
      vehicles.filter((v) => {
        const t = `${v.mqttCarId} ${v.vin ?? ""} ${v.make ?? ""} ${v.model ?? ""}`.toLowerCase();
        return t.includes(query.trim().toLowerCase());
      }),
    [query, vehicles],
  );

  const selected = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  return (
    <div className="split-layout">
      <section className="panel list-panel">
        <header>
          <h2>Vehicle List</h2>
          <button
            className="button primary"
            onClick={() => setShowCreate((v) => !v)}
            type="button"
          >
            {showCreate ? "Cancel" : "+ New vehicle"}
          </button>
        </header>

        {showCreate && (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void createVehicle();
            }}
          >
            <div className="field-row">
              <label>
                VIN
                <input
                  value={vehicleDraft.vin}
                  onChange={(e) => updateVehicleDraft("vin", e.target.value)}
                  placeholder="1HGBH41JXMN109186"
                />
              </label>
            </div>
            <div className="field-row">
              <label>
                Make
                <input
                  value={vehicleDraft.make}
                  onChange={(e) => updateVehicleDraft("make", e.target.value)}
                  placeholder="Toyota"
                />
              </label>
              <label>
                Model
                <input
                  value={vehicleDraft.model}
                  onChange={(e) => updateVehicleDraft("model", e.target.value)}
                  placeholder="Camry"
                />
              </label>
              <label>
                Year
                <input
                  value={vehicleDraft.year}
                  onChange={(e) => updateVehicleDraft("year", e.target.value)}
                  placeholder="2022"
                />
              </label>
            </div>
            <button className="button primary" disabled={busy} type="submit">
              {busy ? "Creating…" : "Create vehicle"}
            </button>
          </form>
        )}

        <label className="search-input" style={{ textTransform: "none", letterSpacing: 0, fontSize: "0.8rem" }}>
          Search vehicles
          <input
            placeholder="VIN, generated vehicle ID, make, model…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {!filtered.length && (
          <EmptyState title="No vehicles found" body="Adjust your search or create a new vehicle." />
        )}

        <div className="list-scroll">
          {filtered.map((vehicle) => (
            <button
              className={`list-item ${selectedVehicleId === vehicle.id ? "selected" : ""}`}
              key={vehicle.id}
              onClick={() => setSelectedVehicleId(vehicle.id)}
              type="button"
            >
              <div className="item-head">
                <strong>{vehicleDisplayName(vehicle)}</strong>
                <StatusBadge status={vehicle.device?.status ?? "NO_DEVICE"} />
              </div>
              <p>{vehicle.vin || "VIN unavailable"}</p>
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
              <StatusBadge status={selected.device?.status ?? "NO_DEVICE"} />
            </header>

            <dl className="detail-grid">
              <div>
                <dt>MQTT Car ID</dt>
                <dd style={{ fontFamily: "DM Mono, monospace" }}>{selected.mqttCarId}</dd>
              </div>
              <div>
                <dt>VIN</dt>
                <dd style={{ fontFamily: "DM Mono, monospace" }}>{selected.vin || "Not provided"}</dd>
              </div>
              <div>
                <dt>Make / Model</dt>
                <dd>{selected.make || "—"} {selected.model || "—"}</dd>
              </div>
              <div>
                <dt>Year</dt>
                <dd>{selected.year || "Unknown"}</dd>
              </div>
              <div>
                <dt>Linked Device</dt>
                <dd style={{ fontFamily: "DM Mono, monospace" }}>
                  {selected.device?.deviceCode || selected.device?.serialNumber || "No linked device"}
                </dd>
              </div>
              <div>
                <dt>Registered</dt>
                <dd>{formatDateTime(selected.createdAt)}</dd>
              </div>
            </dl>
          </>
        )}
      </section>
    </div>
  );
}

/* ─── DEVICES PAGE ──────────────────────────────────────── */
function groupPids(rows: SupportedPidRow[]): Array<{ category: string; rows: SupportedPidRow[] }> {
  const grouped = new Map<string, SupportedPidRow[]>();
  for (const row of rows) {
    const category = row.pid.key.split("_")[0]?.toUpperCase() || "GENERAL";
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
    detachDevice,
    triggerCapabilityDiscovery,
    fetchSupportedPids,
    supportedByVehicle,
  } = useAppModel();
  const [queryByVehicle, setQueryByVehicle] = useState<Record<string, string>>({});

  if (!vehicles.length) {
    return (
      <EmptyState
        title="No vehicles registered"
        body="Add vehicles first. Devices are managed per vehicle."
      />
    );
  }

  return (
    <div className="stack-layout">
      {vehicles.map((vehicle) => {
        const pidData = supportedByVehicle[vehicle.id];
        const search = (queryByVehicle[vehicle.id] ?? "").trim().toLowerCase();
        const supported = (pidData?.supportedPids ?? []).filter((r) => r.isSupported);
        const filtered = supported.filter((r) => {
          const t = `${r.pid.key} ${r.pid.label} ${r.pid.fullCode}`.toLowerCase();
          return t.includes(search);
        });
        const grouped = groupPids(filtered);

        return (
          <section className="panel" key={vehicle.id}>
            <header>
              <h2>{vehicleDisplayName(vehicle)}</h2>
              <StatusBadge status={vehicle.device?.status ?? "NO_DEVICE"} />
            </header>

            <div className="device-grid">
              <div className="device-form">
                <div className="field-row">
                  <label>
                    Device Code
                    <input
                      value={deviceDrafts[vehicle.id]?.deviceCode ?? vehicle.device?.deviceCode ?? ""}
                      onChange={(e) =>
                        setDeviceDrafts((cur) => ({
                          ...cur,
                          [vehicle.id]: {
                            deviceCode: e.target.value,
                            firmwareVersion: cur[vehicle.id]?.firmwareVersion ?? vehicle.device?.firmwareVersion ?? "",
                          },
                        }))
                      }
                      placeholder="OBD-QR-001"
                    />
                  </label>
                  <label>
                    Firmware
                    <input
                      value={deviceDrafts[vehicle.id]?.firmwareVersion ?? vehicle.device?.firmwareVersion ?? ""}
                      onChange={(e) =>
                        setDeviceDrafts((cur) => ({
                          ...cur,
                          [vehicle.id]: {
                            deviceCode: cur[vehicle.id]?.deviceCode ?? vehicle.device?.deviceCode ?? "",
                            firmwareVersion: e.target.value,
                          },
                        }))
                      }
                      placeholder="v1.0.0"
                    />
                  </label>
                </div>

                <div className="action-row">
                  <button
                    className="button primary"
                    onClick={() => void attachOrUpdateDevice(vehicle.id)}
                    type="button"
                  >
                    Attach / Update
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => void triggerCapabilityDiscovery(vehicle.id)}
                    type="button"
                  >
                    Trigger Discovery
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => void fetchSupportedPids(vehicle.id)}
                    type="button"
                  >
                    Load PIDs
                  </button>
                  <button
                    className="button ghost"
                    disabled={!vehicle.device}
                    onClick={() => void detachDevice(vehicle.id)}
                    type="button"
                  >
                    Unlink Device
                  </button>
                </div>

                <dl className="inline-meta">
                  <div>
                    <dt>Device Code</dt>
                    <dd style={{ fontFamily: "DM Mono, monospace" }}>
                      {vehicle.device?.deviceCode || "Not linked"}
                    </dd>
                  </div>
                  <div>
                    <dt>Last Sync</dt>
                    <dd>{formatDateTime(vehicle.device?.lastSeenAt)}</dd>
                  </div>
                  <div>
                    <dt>Discovery Run</dt>
                    <dd>{formatDateTime(vehicle.device?.capabilitiesDiscoveredAt)}</dd>
                  </div>
                </dl>
              </div>

              <div className="pid-panel">
                <header style={{ marginBottom: 10 }}>
                  <h3>Supported Signals</h3>
                  <span style={{ fontFamily: "DM Mono, monospace", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    {filtered.length} loaded
                  </span>
                </header>

                <label className="search-input" style={{ textTransform: "none", letterSpacing: 0 }}>
                  Filter signals
                  <input
                    placeholder="Key, label, or OBD code…"
                    value={queryByVehicle[vehicle.id] ?? ""}
                    onChange={(e) =>
                      setQueryByVehicle((cur) => ({ ...cur, [vehicle.id]: e.target.value }))
                    }
                  />
                </label>

                {!pidData && (
                  <EmptyState
                    title="No PID data"
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
                                  <td style={{ fontFamily: "DM Mono, monospace", color: "var(--accent)", fontSize: "0.78rem" }}>
                                    {row.pid.key}
                                  </td>
                                  <td>{row.pid.label}</td>
                                  <td style={{ fontFamily: "DM Mono, monospace", fontSize: "0.78rem" }}>
                                    {row.pid.fullCode}
                                  </td>
                                  <td style={{ color: "var(--text-muted)" }}>{row.pid.unit || "—"}</td>
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

/* ─── CONVERSATIONS PAGE ────────────────────────────────── */
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

  const selectedRequest = requests.find((r) => r.id === selectedRequestId) ?? null;

  return (
    <div className="conversation-layout">
      <aside className="panel request-list-panel">
        <header>
          <h2>Requests</h2>
          <span style={{ fontFamily: "DM Mono, monospace", fontSize: "0.72rem" }}>
            {requests.length} total
          </span>
        </header>

        {!requests.length && (
          <EmptyState
            title="No requests"
            body="Create a diagnostic request from the composer below."
          />
        )}

        <div className="list-scroll">
          {requests.map((request) => (
            <button
              className={`list-item ${selectedRequestId === request.id ? "selected" : ""}`}
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
          <h2>Conversation Thread</h2>
          {selectedRequest && <StatusBadge status={selectedRequest.status} />}
        </header>

        {!selectedRequest && (
          <EmptyState
            title="No conversation selected"
            body="Pick a request from the left panel or create a new one below."
          />
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
              <p>{requestDetail?.profile?.name || "Awaiting classification…"}</p>
              {requestDetail?.profile?.rationale && (
                <span>{requestDetail.profile.rationale}</span>
              )}
            </article>

            <article className="thread-block system">
              <small>Run Status</small>
              <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusBadge status={requestDetail?.latestRun?.status || selectedRequest.status} />
              </p>
            </article>

            {!!requestDetail?.latestRun?.measurements.length && (
              <article className="thread-block system">
                <small>Measurements</small>
                <MeasurementGrid measurements={requestDetail.latestRun.measurements} />
              </article>
            )}

            {!!requestDetail?.latestRun?.dtcs.length && (
              <article className="thread-block system">
                <small>Diagnostic Trouble Codes</small>
                <DtcTable dtcs={requestDetail.latestRun.dtcs} />
              </article>
            )}

            {reportDetail && (
              <article className="thread-block system">
                <small>Report Preview</small>
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
          onSubmit={(e) => {
            e.preventDefault();
            void createDiagnosticRequest();
          }}
        >
          <div className="field-row">
            <label>
              Vehicle
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
              >
                <option value="" disabled>Select vehicle…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleDisplayName(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Complaint
            <textarea
              placeholder="Describe the observed issue and conditions in detail…"
              rows={3}
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
            />
          </label>

          <div className="composer-foot">
            <p>Initiates a backend diagnostic workflow on submission.</p>
            <button className="button primary" type="submit">
              Submit Request
            </button>
          </div>
        </form>
      </section>

      <aside className="panel metadata-panel">
        <header>
          <h2>Request Metadata</h2>
        </header>

        {!selectedRequest && (
          <EmptyState
            title="No metadata"
            body="Select a request to inspect vehicle and processing details."
          />
        )}

        {!!selectedRequest && (
          <dl className="detail-grid">
            <div>
              <dt>Request ID</dt>
              <dd style={{ fontFamily: "DM Mono, monospace", fontSize: "0.75rem", wordBreak: "break-all" }}>
                {selectedRequest.id}
              </dd>
            </div>
            <div>
              <dt>Vehicle</dt>
              <dd>{vehicleDisplayName(selectedRequest.vehicle)}</dd>
            </div>
            <div>
              <dt>MQTT Car ID</dt>
              <dd style={{ fontFamily: "DM Mono, monospace", fontSize: "0.78rem" }}>
                {selectedRequest.vehicle.mqttCarId}
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(selectedRequest.createdAt)}</dd>
            </div>
            <div>
              <dt>Last Update</dt>
              <dd>{formatDateTime(selectedRequest.updatedAt)}</dd>
            </div>
            <div>
              <dt>Run ID</dt>
              <dd style={{ fontFamily: "DM Mono, monospace", fontSize: "0.75rem", wordBreak: "break-all" }}>
                {selectedRequest.latestRun?.id || "—"}
              </dd>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <dt>Profile</dt>
              <dd>{selectedRequest.profile?.name || "—"}</dd>
            </div>
          </dl>
        )}
      </aside>
    </div>
  );
}

/* ─── REPORTS PAGE ──────────────────────────────────────── */
export function ReportsPage() {
  const { requests, selectedRequestId, setSelectedRequestId, reportDetail } = useAppModel();
  const reports = requests.filter((r) => r.hasReport);
  const selectedRequest = reports.find((r) => r.id === selectedRequestId) ?? null;

  return (
    <div className="split-layout">
      <section className="panel list-panel">
        <header>
          <h2>Report List</h2>
          <span style={{ fontFamily: "DM Mono, monospace", fontSize: "0.72rem" }}>
            {reports.length} reports
          </span>
        </header>

        {!reports.length && (
          <EmptyState
            title="No reports available"
            body="Reports appear here after completed diagnostic runs."
          />
        )}

        <div className="list-scroll">
          {reports.map((request) => (
            <button
              className={`list-item ${selectedRequestId === request.id ? "selected" : ""}`}
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
        {!reportDetail && (
          <EmptyState
            title="Select a report"
            body="Choose a report from the list to read full output and export PDF."
          />
        )}

        {!!reportDetail && (
          <>
            <header>
              <h2>Report Viewer</h2>
              <button
                className="button primary"
                onClick={() => downloadReportPdf(reportDetail, selectedRequest)}
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 2v8M5 7l3 3 3-3" />
                  <path d="M2 12v2h12v-2" />
                </svg>
                Download PDF
              </button>
            </header>

            <article className="report-section">
              <h3>Summary</h3>
              <p>{reportDetail.reportJson.summary}</p>
            </article>

            <div className="report-grid">
              <article className="report-section">
                <h3>Possible Causes</h3>
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
              <h3>Confidence Score</h3>
              <div className="confidence-value">
                {Math.round(reportDetail.reportJson.confidence * 100)}%
              </div>
            </article>
          </>
        )}
      </section>
    </div>
  );
}

function formatPercent(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  return `${Math.round(value * 100)}%`;
}

function formatConfidence(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  return `${Math.round(value * 100)}%`;
}

function formatDuration(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  return `${(value / 1000).toFixed(1)} s`;
}

/* ─── ADMIN PAGE ────────────────────────────────────────── */
export function SettingsPage() {
  const {
    auth,
    busy,
    adminLoading,
    adminDashboard,
    adminUsers,
    adminDevices,
    adminUserDraft,
    adminDeviceDraft,
    setAdminUserDraft,
    setAdminDeviceDraft,
    refreshAdminWorkspace,
    createAdminUser,
    updateAdminUser,
    deleteAdminUser,
    createAdminDevice,
    updateAdminDevice,
    deleteAdminDevice,
  } = useAppModel();
  const [userEdits, setUserEdits] = useState<
    Record<string, { displayName: string; email: string; role: "ADMIN" | "USER"; password: string }>
  >({});
  const [deviceEdits, setDeviceEdits] = useState<
    Record<string, { deviceCode: string; serialNumber: string; firmwareVersion: string; status: string }>
  >({});

  if (auth?.user.role !== "ADMIN") {
    return (
      <div className="view-stack">
        <section className="panel">
          <header>
            <h2>Admin Access</h2>
            <span>Restricted</span>
          </header>
          <p className="muted-body">
            This area is only available to administrator accounts.
          </p>
        </section>
      </div>
    );
  }

  const kpis = adminDashboard
    ? [
        {
          label: "Users",
          value: adminDashboard.totals.users,
          meta: `${adminDashboard.totals.admins} admins`,
          colorClass: "cyan",
        },
        {
          label: "Active Vehicles",
          value: adminDashboard.totals.activeVehicles,
          meta: `${adminDashboard.totals.vehicles} total`,
          colorClass: "green",
        },
        {
          label: "Reports",
          value: adminDashboard.totals.reports,
          meta: `${adminDashboard.totals.diagnosticRequests} requests`,
          colorClass: "purple",
        },
        {
          label: "Avg Response",
          value: formatDuration(adminDashboard.rates.averageResponseTimeMs),
          meta: formatPercent(adminDashboard.rates.runResponseRate),
          colorClass: "orange",
        },
      ]
    : [];

  return (
    <div className="view-stack">
      <section className="panel">
        <header>
          <h2>Admin Operations Center</h2>
          <button
            className="button ghost"
            disabled={busy || adminLoading}
            onClick={() => void refreshAdminWorkspace()}
            type="button"
          >
            Refresh Admin Data
          </button>
        </header>
        <p className="muted-body">
          Centralized oversight for platform health, user management, and global
          device inventory.
        </p>
      </section>

      {!!adminDashboard && (
        <section className="kpi-strip">
          {kpis.map((kpi) => (
            <article className="kpi-card" key={kpi.label}>
              <div className={`kpi-card-icon ${kpi.colorClass}`}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 14V6M10 14V3M16 14V9" />
                </svg>
              </div>
              <div>
                <div className="kpi-value">{kpi.value}</div>
                <div className="kpi-label">{kpi.label}</div>
              </div>
              <small className="admin-kpi-meta">{kpi.meta}</small>
            </article>
          ))}
        </section>
      )}

      {adminLoading && (
        <section className="panel">
          <SkeletonRows count={6} />
        </section>
      )}

      {!!adminDashboard && (
        <section className="admin-grid">
          <article className="panel">
            <header>
              <h2>Useful Stats</h2>
              <span>{formatDateTime(adminDashboard.generatedAt)}</span>
            </header>
            <dl className="detail-grid">
              <div>
                <dt>Avg Classification Confidence</dt>
                <dd>{formatConfidence(adminDashboard.rates.averageClassificationConfidence)}</dd>
              </div>
              <div>
                <dt>Avg Report Confidence</dt>
                <dd>{formatConfidence(adminDashboard.rates.averageReportConfidence)}</dd>
              </div>
              <div>
                <dt>Device Utilization</dt>
                <dd>{formatPercent(adminDashboard.rates.deviceUtilizationRate)}</dd>
              </div>
              <div>
                <dt>Users With Vehicles</dt>
                <dd>{formatPercent(adminDashboard.rates.usersWithVehiclesRate)}</dd>
              </div>
              <div>
                <dt>Avg Supported PIDs / Vehicle</dt>
                <dd>{Math.round(adminDashboard.rates.averageSupportedPidCountPerVehicle)}</dd>
              </div>
              <div>
                <dt>Runs Responded</dt>
                <dd>
                  {adminDashboard.runStats.respondedRuns}/{adminDashboard.runStats.totalRuns}
                </dd>
              </div>
            </dl>
          </article>

          <article className="panel">
            <header>
              <h2>Request Pipeline</h2>
              <span>{adminDashboard.totals.diagnosticRequests} tracked</span>
            </header>
            <div className="admin-stat-list">
              {Object.entries(adminDashboard.requestStatusCounts).map(([status, count]) => (
                <div className="admin-stat-row" key={status}>
                  <StatusBadge status={status} />
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <header>
              <h2>Device Fleet</h2>
              <span>{adminDashboard.totals.devices} devices</span>
            </header>
            <div className="admin-stat-list">
              {Object.entries(adminDashboard.deviceStatusCounts).map(([status, count]) => (
                <div className="admin-stat-row" key={status}>
                  <StatusBadge status={status} />
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <header>
              <h2>Top Profiles</h2>
              <span>{adminDashboard.topProfiles.length} ranked</span>
            </header>
            {!adminDashboard.topProfiles.length && (
              <EmptyState
                title="No classified profiles yet"
                body="Top profile usage will appear once diagnostic requests are classified."
              />
            )}
            {!!adminDashboard.topProfiles.length && (
              <div className="admin-stat-list">
                {adminDashboard.topProfiles.map((profile) => (
                  <div className="admin-profile-row" key={profile.profileId ?? profile.name ?? profile.code ?? "unknown"}>
                    <div>
                      <strong>{profile.name || profile.code || "Unknown profile"}</strong>
                      <p>{profile.code || "No code"}</p>
                    </div>
                    <span>{profile.requestCount}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}

      {!!adminDashboard && (
        <section className="admin-grid">
          <article className="panel">
            <header>
              <h2>Recent Reports</h2>
              <span>{adminDashboard.recentReports.length} recent</span>
            </header>
            {!adminDashboard.recentReports.length && (
              <EmptyState
                title="No reports yet"
                body="Generated reports will show up here for quick operational review."
              />
            )}
            {!!adminDashboard.recentReports.length && (
              <ul className="report-list">
                {adminDashboard.recentReports.map((report) => (
                  <li key={report.id}>
                    <div>
                      <strong>{compactText(report.summary, 90)}</strong>
                      <p>{vehicleDisplayName(report.vehicle)}</p>
                    </div>
                    <div className="activity-meta">
                      <small>{formatConfidence(report.confidence)}</small>
                      <small>{formatDateTime(report.createdAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="panel">
            <header>
              <h2>Newest Users</h2>
              <span>{adminDashboard.recentUsers.length} recent</span>
            </header>
            <div className="admin-stat-list">
              {adminDashboard.recentUsers.map((user) => (
                <div className="admin-profile-row" key={user.id}>
                  <div>
                    <strong>{user.displayName}</strong>
                    <p>{user.email}</p>
                  </div>
                  <div className="activity-meta">
                    <StatusBadge status={user.role} />
                    <small>{formatDateTime(user.createdAt)}</small>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      <section className="panel">
        <header>
          <h2>User Management</h2>
          <span>{adminUsers.length} users</span>
        </header>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void createAdminUser();
          }}
        >
          <div className="field-row">
            <label>
              Display Name
              <input
                value={adminUserDraft.displayName}
                onChange={(e) =>
                  setAdminUserDraft((current) => ({
                    ...current,
                    displayName: e.target.value,
                  }))
                }
                placeholder="Platform Operator"
              />
            </label>
            <label>
              Email
              <input
                value={adminUserDraft.email}
                onChange={(e) =>
                  setAdminUserDraft((current) => ({ ...current, email: e.target.value }))
                }
                placeholder="operator@company.com"
                type="email"
              />
            </label>
            <label>
              Password
              <input
                value={adminUserDraft.password}
                onChange={(e) =>
                  setAdminUserDraft((current) => ({
                    ...current,
                    password: e.target.value,
                  }))
                }
                placeholder="Minimum 8 characters"
                type="password"
              />
            </label>
            <label>
              Role
              <select
                value={adminUserDraft.role}
                onChange={(e) =>
                  setAdminUserDraft((current) => ({
                    ...current,
                    role: e.target.value as "ADMIN" | "USER",
                  }))
                }
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
          </div>
          <button className="button primary" disabled={busy} type="submit">
            Create User
          </button>
        </form>

        <div className="table-frame">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Stats</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input
                      value={userEdits[user.id]?.displayName ?? user.displayName}
                      onChange={(e) =>
                        setUserEdits((current) => ({
                          ...current,
                          [user.id]: {
                            displayName: e.target.value,
                            email: current[user.id]?.email ?? user.email,
                            role: current[user.id]?.role ?? user.role,
                            password: current[user.id]?.password ?? "",
                          },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="email"
                      value={userEdits[user.id]?.email ?? user.email}
                      onChange={(e) =>
                        setUserEdits((current) => ({
                          ...current,
                          [user.id]: {
                            displayName: current[user.id]?.displayName ?? user.displayName,
                            email: e.target.value,
                            role: current[user.id]?.role ?? user.role,
                            password: current[user.id]?.password ?? "",
                          },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={userEdits[user.id]?.role ?? user.role}
                      onChange={(e) =>
                        setUserEdits((current) => ({
                          ...current,
                          [user.id]: {
                            displayName: current[user.id]?.displayName ?? user.displayName,
                            email: current[user.id]?.email ?? user.email,
                            role: e.target.value as "ADMIN" | "USER",
                            password: current[user.id]?.password ?? "",
                          },
                        }))
                      }
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td>
                    {user.stats.vehicleCount} vehicles / {user.stats.diagnosticRequestCount} requests /{" "}
                    {formatConfidence(user.stats.averageClassificationConfidence)}
                    <div style={{ marginTop: 8 }}>
                      <input
                        placeholder="New password (optional)"
                        type="password"
                        value={userEdits[user.id]?.password ?? ""}
                        onChange={(e) =>
                          setUserEdits((current) => ({
                            ...current,
                            [user.id]: {
                              displayName: current[user.id]?.displayName ?? user.displayName,
                              email: current[user.id]?.email ?? user.email,
                              role: current[user.id]?.role ?? user.role,
                              password: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </td>
                  <td>
                    <div className="action-row">
                      <button
                        className="button ghost"
                        onClick={() =>
                          void updateAdminUser(user.id, {
                            displayName: userEdits[user.id]?.displayName ?? user.displayName,
                            email: userEdits[user.id]?.email ?? user.email,
                            role: userEdits[user.id]?.role ?? user.role,
                            password: userEdits[user.id]?.password ?? "",
                          })
                        }
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        className="button danger"
                        onClick={() => void deleteAdminUser(user.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <header>
          <h2>Device Inventory</h2>
          <span>{adminDevices.length} devices</span>
        </header>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void createAdminDevice();
          }}
        >
          <div className="field-row">
            <label>
              Device Code
              <input
                value={adminDeviceDraft.deviceCode}
                onChange={(e) =>
                  setAdminDeviceDraft((current) => ({
                    ...current,
                    deviceCode: e.target.value,
                  }))
                }
                placeholder="OBD-QR-001"
              />
            </label>
            <label>
              Serial Number
              <input
                value={adminDeviceDraft.serialNumber}
                onChange={(e) =>
                  setAdminDeviceDraft((current) => ({
                    ...current,
                    serialNumber: e.target.value,
                  }))
                }
                placeholder="stm32-dev-001"
              />
            </label>
            <label>
              Firmware
              <input
                value={adminDeviceDraft.firmwareVersion}
                onChange={(e) =>
                  setAdminDeviceDraft((current) => ({
                    ...current,
                    firmwareVersion: e.target.value,
                  }))
                }
                placeholder="fw-1.0.0"
              />
            </label>
            <label>
              Status
              <select
                value={adminDeviceDraft.status}
                onChange={(e) =>
                  setAdminDeviceDraft((current) => ({
                    ...current,
                    status: e.target.value,
                  }))
                }
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="LINKED">LINKED</option>
                <option value="OFFLINE">OFFLINE</option>
                <option value="ERROR">ERROR</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </label>
          </div>
          <button className="button primary" disabled={busy} type="submit">
            Create Device
          </button>
        </form>

        <div className="table-frame">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>Vehicle</th>
                <th>Firmware</th>
                <th>Health</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminDevices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <input
                      value={deviceEdits[device.id]?.deviceCode ?? device.deviceCode}
                      onChange={(e) =>
                        setDeviceEdits((current) => ({
                          ...current,
                          [device.id]: {
                            deviceCode: e.target.value,
                            serialNumber: current[device.id]?.serialNumber ?? device.serialNumber ?? "",
                            firmwareVersion: current[device.id]?.firmwareVersion ?? device.firmwareVersion ?? "",
                            status: current[device.id]?.status ?? device.status,
                          },
                        }))
                      }
                    />
                    <div style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
                      <input
                        value={deviceEdits[device.id]?.serialNumber ?? device.serialNumber ?? ""}
                        onChange={(e) =>
                          setDeviceEdits((current) => ({
                            ...current,
                            [device.id]: {
                              deviceCode: current[device.id]?.deviceCode ?? device.deviceCode,
                              serialNumber: e.target.value,
                              firmwareVersion: current[device.id]?.firmwareVersion ?? device.firmwareVersion ?? "",
                              status: current[device.id]?.status ?? device.status,
                            },
                          }))
                        }
                        placeholder="No serial"
                      />
                    </div>
                  </td>
                  <td>
                    <select
                      value={deviceEdits[device.id]?.status ?? device.status}
                      onChange={(e) =>
                        setDeviceEdits((current) => ({
                          ...current,
                          [device.id]: {
                            deviceCode: current[device.id]?.deviceCode ?? device.deviceCode,
                            serialNumber: current[device.id]?.serialNumber ?? device.serialNumber ?? "",
                            firmwareVersion: current[device.id]?.firmwareVersion ?? device.firmwareVersion ?? "",
                            status: e.target.value,
                          },
                        }))
                      }
                    >
                      <option value="AVAILABLE">AVAILABLE</option>
                      <option value="LINKED">LINKED</option>
                      <option value="OFFLINE">OFFLINE</option>
                      <option value="ERROR">ERROR</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                  </td>
                  <td>{device.vehicle ? vehicleDisplayName(device.vehicle) : "Unassigned"}</td>
                  <td>
                    <input
                      value={deviceEdits[device.id]?.firmwareVersion ?? device.firmwareVersion ?? ""}
                      onChange={(e) =>
                        setDeviceEdits((current) => ({
                          ...current,
                          [device.id]: {
                            deviceCode: current[device.id]?.deviceCode ?? device.deviceCode,
                            serialNumber: current[device.id]?.serialNumber ?? device.serialNumber ?? "",
                            firmwareVersion: e.target.value,
                            status: current[device.id]?.status ?? device.status,
                          },
                        }))
                      }
                      placeholder="—"
                    />
                  </td>
                  <td>
                    Last seen: {formatDateTime(device.lastSeenAt)}
                    <br />
                    Discovery: {formatDateTime(device.capabilitiesDiscoveredAt)}
                  </td>
                  <td>
                    <div className="action-row">
                      <button
                        className="button ghost"
                        onClick={() =>
                          void updateAdminDevice(device.id, {
                            deviceCode: deviceEdits[device.id]?.deviceCode ?? device.deviceCode,
                            serialNumber: deviceEdits[device.id]?.serialNumber ?? device.serialNumber ?? "",
                            firmwareVersion:
                              deviceEdits[device.id]?.firmwareVersion ?? device.firmwareVersion ?? "",
                            status: deviceEdits[device.id]?.status ?? device.status,
                          })
                        }
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        className="button danger"
                        onClick={() => void deleteAdminDevice(device.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
