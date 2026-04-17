/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  apiRequest,
  ApiError,
  AUTH_STORAGE_KEY,
  REQUEST_SELECTION_STORAGE_KEY,
  VEHICLE_SELECTION_STORAGE_KEY,
  readStoredAuth,
} from './lib';
import type {
  AuthMode,
  AuthSession,
  AuthUser,
  DiagnosticRequestDetail,
  DiagnosticRequestSummary,
  ReportResponse,
  SupportedPidResponse,
  Vehicle,
} from './types';

type DeviceDrafts = Record<string, { serialNumber: string; firmwareVersion: string }>;

interface VehicleDraft {
  mqttCarId: string;
  vin: string;
  make: string;
  model: string;
  year: string;
}

interface AppModelValue {
  auth: AuthSession | null;
  initializing: boolean;
  busy: boolean;
  toast: string | null;
  workspaceError: string | null;
  vehicles: Vehicle[];
  requests: DiagnosticRequestSummary[];
  selectedVehicleId: string;
  selectedRequestId: string;
  requestDetail: DiagnosticRequestDetail | null;
  reportDetail: ReportResponse | null;
  detailLoading: boolean;
  supportedByVehicle: Record<string, SupportedPidResponse>;
  deviceDrafts: DeviceDrafts;
  complaintText: string;
  vehicleDraft: VehicleDraft;
  setToast: (value: string | null) => void;
  setSelectedVehicleId: (value: string) => void;
  setSelectedRequestId: (value: string) => void;
  setComplaintText: (value: string) => void;
  updateVehicleDraft: (key: keyof VehicleDraft, value: string) => void;
  setDeviceDrafts: Dispatch<SetStateAction<DeviceDrafts>>;
  authenticate: (mode: AuthMode, email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  refreshWorkspace: () => Promise<void>;
  createVehicle: () => Promise<void>;
  attachOrUpdateDevice: (vehicleId: string) => Promise<void>;
  triggerCapabilityDiscovery: (vehicleId: string) => Promise<void>;
  fetchSupportedPids: (vehicleId: string) => Promise<void>;
  createDiagnosticRequest: () => Promise<void>;
}

const AppModelContext = createContext<AppModelValue | null>(null);

const initialVehicleDraft: VehicleDraft = {
  mqttCarId: '',
  vin: '',
  make: '',
  model: '',
  year: '',
};

function readStoredSelection(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthSession | null>(() => readStoredAuth());
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<DiagnosticRequestSummary[]>([]);
  const [selectedVehicleId, setSelectedVehicleIdState] = useState(() => readStoredSelection(VEHICLE_SELECTION_STORAGE_KEY));
  const [selectedRequestId, setSelectedRequestIdState] = useState(() => readStoredSelection(REQUEST_SELECTION_STORAGE_KEY));
  const [requestDetail, setRequestDetail] = useState<DiagnosticRequestDetail | null>(null);
  const [reportDetail, setReportDetail] = useState<ReportResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [supportedByVehicle, setSupportedByVehicle] = useState<Record<string, SupportedPidResponse>>({});
  const [deviceDrafts, setDeviceDrafts] = useState<DeviceDrafts>({});
  const [complaintText, setComplaintText] = useState('');
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>(initialVehicleDraft);

  useEffect(() => {
    if (auth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [auth]);

  useEffect(() => {
    if (selectedVehicleId) {
      localStorage.setItem(VEHICLE_SELECTION_STORAGE_KEY, selectedVehicleId);
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    if (selectedRequestId) {
      localStorage.setItem(REQUEST_SELECTION_STORAGE_KEY, selectedRequestId);
    }
  }, [selectedRequestId]);

  const withAuth = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      if (!auth) throw new Error('Sign in required.');
      try {
        return await apiRequest<T>(path, {
          ...options,
          accessToken: auth.accessToken,
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        const refreshed = await apiRequest<AuthSession>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });
        setAuth(refreshed);
        return apiRequest<T>(path, {
          ...options,
          accessToken: refreshed.accessToken,
        });
      }
    },
    [auth],
  );

  const setSelectedVehicleId = useCallback((value: string) => {
    setSelectedVehicleIdState(value);
  }, []);

  const setSelectedRequestId = useCallback((value: string) => {
    setSelectedRequestIdState(value);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (!auth) return;
    setWorkspaceError(null);
    const [vehicleList, requestList] = await Promise.all([
      withAuth<Vehicle[]>('/vehicles'),
      withAuth<DiagnosticRequestSummary[]>('/diagnostic-requests'),
    ]);

    setVehicles(vehicleList);
    setRequests(requestList);

    setSelectedVehicleIdState((current) => {
      if (current && vehicleList.some((item) => item.id === current)) return current;
      return vehicleList[0]?.id ?? '';
    });

    setSelectedRequestIdState((current) => {
      if (current && requestList.some((item) => item.id === current)) return current;
      return requestList[0]?.id ?? '';
    });
  }, [auth, withAuth]);

  useEffect(() => {
    if (!auth) {
      setInitializing(false);
      return;
    }

    let active = true;
    void (async () => {
      try {
        await withAuth<AuthUser>('/auth/me');
        await refreshWorkspace();
      } catch (error) {
        if (active) {
          setAuth(null);
          setWorkspaceError(error instanceof Error ? error.message : 'Authentication failed.');
        }
      } finally {
        if (active) setInitializing(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [auth, refreshWorkspace, withAuth]);

  useEffect(() => {
    if (!auth || !selectedRequestId) {
      setRequestDetail(null);
      setReportDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const detail = await withAuth<DiagnosticRequestDetail>(`/diagnostic-requests/${selectedRequestId}`);
        if (cancelled) return;
        setRequestDetail(detail);

        const summary = requests.find((item) => item.id === selectedRequestId);
        if (summary?.hasReport) {
          const report = await withAuth<ReportResponse>(`/reports/${selectedRequestId}`);
          if (!cancelled) {
            setReportDetail(report);
          }
        } else {
          setReportDetail(null);
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(error instanceof Error ? error.message : 'Unable to load the selected diagnostic request.');
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, requests, selectedRequestId, withAuth]);

  const updateVehicleDraft = useCallback((key: keyof VehicleDraft, value: string) => {
    setVehicleDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const authenticate = useCallback(
    async (mode: AuthMode, email: string, password: string, displayName?: string) => {
      setBusy(true);
      setWorkspaceError(null);
      try {
        const session =
          mode === 'register'
            ? await apiRequest<AuthSession>('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ email, password, displayName }),
              })
            : await apiRequest<AuthSession>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
              });

        setAuth(session);
        setToast(`Welcome back, ${session.user.displayName}.`);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setAuth(null);
    setVehicles([]);
    setRequests([]);
    setRequestDetail(null);
    setReportDetail(null);
    setSupportedByVehicle({});
    setSelectedVehicleIdState('');
    setSelectedRequestIdState('');
    setToast('Session closed.');
  }, []);

  const createVehicle = useCallback(async () => {
    if (!vehicleDraft.mqttCarId.trim()) {
      setWorkspaceError('MQTT car ID is required.');
      return;
    }

    setBusy(true);
    setWorkspaceError(null);
    try {
      const created = await withAuth<Vehicle>('/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          mqttCarId: vehicleDraft.mqttCarId.trim(),
          vin: vehicleDraft.vin.trim() || undefined,
          make: vehicleDraft.make.trim() || undefined,
          model: vehicleDraft.model.trim() || undefined,
          year: vehicleDraft.year.trim() ? Number(vehicleDraft.year.trim()) : undefined,
        }),
      });

      await refreshWorkspace();
      setVehicleDraft(initialVehicleDraft);
      startTransition(() => {
        setSelectedVehicleIdState(created.id);
      });
      setToast('Vehicle created successfully.');
    } finally {
      setBusy(false);
    }
  }, [refreshWorkspace, vehicleDraft, withAuth]);

  const attachOrUpdateDevice = useCallback(
    async (vehicleId: string) => {
      const draft = deviceDrafts[vehicleId];
      if (!draft?.serialNumber.trim()) {
        setWorkspaceError('Device serial number is required.');
        return;
      }

      setBusy(true);
      setWorkspaceError(null);
      try {
        await withAuth(`/vehicles/${vehicleId}/devices`, {
          method: 'POST',
          body: JSON.stringify({
            serialNumber: draft.serialNumber.trim(),
            firmwareVersion: draft.firmwareVersion.trim() || undefined,
          }),
        });
        await refreshWorkspace();
        setToast('Device updated successfully.');
      } finally {
        setBusy(false);
      }
    },
    [deviceDrafts, refreshWorkspace, withAuth],
  );

  const triggerCapabilityDiscovery = useCallback(
    async (vehicleId: string) => {
      setBusy(true);
      setWorkspaceError(null);
      try {
        await withAuth(`/vehicles/${vehicleId}/discover-capabilities`, {
          method: 'POST',
        });
        setToast('Capability discovery triggered.');
      } finally {
        setBusy(false);
      }
    },
    [withAuth],
  );

  const fetchSupportedPids = useCallback(
    async (vehicleId: string) => {
      setBusy(true);
      setWorkspaceError(null);
      try {
        const payload = await withAuth<SupportedPidResponse>(`/vehicles/${vehicleId}/supported-pids`);
        setSupportedByVehicle((current) => ({ ...current, [vehicleId]: payload }));
        setToast('Supported signal matrix loaded.');
      } finally {
        setBusy(false);
      }
    },
    [withAuth],
  );

  const createDiagnosticRequest = useCallback(async () => {
    if (!selectedVehicleId) {
      setWorkspaceError('Select a vehicle before creating a request.');
      return;
    }
    if (!complaintText.trim()) {
      setWorkspaceError('Diagnostic complaint cannot be empty.');
      return;
    }

    setBusy(true);
    setWorkspaceError(null);
    try {
      const response = await withAuth<{ requestId: string }>('/diagnostic-requests', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: selectedVehicleId,
          complaintText: complaintText.trim(),
        }),
      });
      await refreshWorkspace();
      setComplaintText('');
      startTransition(() => {
        setSelectedRequestIdState(response.requestId);
      });
      setToast('Diagnostic request submitted.');
    } finally {
      setBusy(false);
    }
  }, [complaintText, refreshWorkspace, selectedVehicleId, withAuth]);

  const value = useMemo<AppModelValue>(
    () => ({
      auth,
      initializing,
      busy,
      toast,
      workspaceError,
      vehicles,
      requests,
      selectedVehicleId,
      selectedRequestId,
      requestDetail,
      reportDetail,
      detailLoading,
      supportedByVehicle,
      deviceDrafts,
      complaintText,
      vehicleDraft,
      setToast,
      setSelectedVehicleId,
      setSelectedRequestId,
      setComplaintText,
      updateVehicleDraft,
      setDeviceDrafts,
      authenticate,
      logout,
      refreshWorkspace,
      createVehicle,
      attachOrUpdateDevice,
      triggerCapabilityDiscovery,
      fetchSupportedPids,
      createDiagnosticRequest,
    }),
    [
      auth,
      initializing,
      busy,
      toast,
      workspaceError,
      vehicles,
      requests,
      selectedVehicleId,
      selectedRequestId,
      requestDetail,
      reportDetail,
      detailLoading,
      supportedByVehicle,
      deviceDrafts,
      complaintText,
      vehicleDraft,
      setSelectedVehicleId,
      setSelectedRequestId,
      updateVehicleDraft,
      authenticate,
      logout,
      refreshWorkspace,
      createVehicle,
      attachOrUpdateDevice,
      triggerCapabilityDiscovery,
      fetchSupportedPids,
      createDiagnosticRequest,
    ],
  );

  return <AppModelContext.Provider value={value}>{children}</AppModelContext.Provider>;
}

export function useAppModel(): AppModelValue {
  const value = useContext(AppModelContext);
  if (!value) {
    throw new Error('useAppModel must be used within AppProvider.');
  }
  return value;
}
