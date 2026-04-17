/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  apiRequest,
  ApiError,
  AUTH_STORAGE_KEY,
  REQUEST_SELECTION_STORAGE_KEY,
  VEHICLE_SELECTION_STORAGE_KEY,
  readStoredAuth,
} from "./lib";
import type {
  AdminDashboardStats,
  AdminDeviceRow,
  AdminUserRow,
  AuthMode,
  AuthSession,
  AuthUser,
  DiagnosticRequestDetail,
  DiagnosticRequestSummary,
  ReportResponse,
  SupportedPidResponse,
  Vehicle,
} from "./types";

type DeviceDrafts = Record<
  string,
  { deviceCode: string; firmwareVersion: string }
>;

interface VehicleDraft {
  vin: string;
  make: string;
  model: string;
  year: string;
}

interface AdminUserDraft {
  email: string;
  displayName: string;
  password: string;
  role: "ADMIN" | "USER";
}

interface AdminDeviceDraft {
  deviceCode: string;
  serialNumber: string;
  firmwareVersion: string;
  status: string;
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
  adminDashboard: AdminDashboardStats | null;
  adminUsers: AdminUserRow[];
  adminDevices: AdminDeviceRow[];
  adminLoading: boolean;
  adminUserDraft: AdminUserDraft;
  adminDeviceDraft: AdminDeviceDraft;
  deviceDrafts: DeviceDrafts;
  complaintText: string;
  vehicleDraft: VehicleDraft;
  setToast: (value: string | null) => void;
  setSelectedVehicleId: (value: string) => void;
  setSelectedRequestId: (value: string) => void;
  setComplaintText: (value: string) => void;
  setAdminUserDraft: Dispatch<SetStateAction<AdminUserDraft>>;
  setAdminDeviceDraft: Dispatch<SetStateAction<AdminDeviceDraft>>;
  updateVehicleDraft: (key: keyof VehicleDraft, value: string) => void;
  setDeviceDrafts: Dispatch<SetStateAction<DeviceDrafts>>;
  authenticate: (
    mode: AuthMode,
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  logout: () => void;
  refreshWorkspace: () => Promise<void>;
  createVehicle: () => Promise<void>;
  attachOrUpdateDevice: (vehicleId: string) => Promise<void>;
  detachDevice: (vehicleId: string) => Promise<void>;
  triggerCapabilityDiscovery: (vehicleId: string) => Promise<void>;
  fetchSupportedPids: (vehicleId: string) => Promise<void>;
  createDiagnosticRequest: () => Promise<void>;
  refreshAdminWorkspace: () => Promise<void>;
  createAdminUser: () => Promise<void>;
  updateAdminUser: (userId: string, patch: Partial<AdminUserDraft>) => Promise<void>;
  deleteAdminUser: (userId: string) => Promise<void>;
  createAdminDevice: () => Promise<void>;
  updateAdminDevice: (deviceId: string, patch: Partial<AdminDeviceDraft>) => Promise<void>;
  deleteAdminDevice: (deviceId: string) => Promise<void>;
}

const AppModelContext = createContext<AppModelValue | null>(null);

const initialVehicleDraft: VehicleDraft = {
  vin: "",
  make: "",
  model: "",
  year: "",
};

const initialAdminUserDraft: AdminUserDraft = {
  email: "",
  displayName: "",
  password: "",
  role: "USER",
};

const initialAdminDeviceDraft: AdminDeviceDraft = {
  deviceCode: "",
  serialNumber: "",
  firmwareVersion: "",
  status: "AVAILABLE",
};

function readStoredSelection(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
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
  const [selectedVehicleId, setSelectedVehicleIdState] = useState(() =>
    readStoredSelection(VEHICLE_SELECTION_STORAGE_KEY),
  );
  const [selectedRequestId, setSelectedRequestIdState] = useState(() =>
    readStoredSelection(REQUEST_SELECTION_STORAGE_KEY),
  );
  const [requestDetail, setRequestDetail] =
    useState<DiagnosticRequestDetail | null>(null);
  const [reportDetail, setReportDetail] = useState<ReportResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [supportedByVehicle, setSupportedByVehicle] = useState<
    Record<string, SupportedPidResponse>
  >({});
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardStats | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [adminDevices, setAdminDevices] = useState<AdminDeviceRow[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminUserDraft, setAdminUserDraft] = useState<AdminUserDraft>(initialAdminUserDraft);
  const [adminDeviceDraft, setAdminDeviceDraft] = useState<AdminDeviceDraft>(initialAdminDeviceDraft);
  const [deviceDrafts, setDeviceDrafts] = useState<DeviceDrafts>({});
  const [complaintText, setComplaintText] = useState("");
  const [vehicleDraft, setVehicleDraft] =
    useState<VehicleDraft>(initialVehicleDraft);

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
      if (!auth) throw new Error("Sign in required.");
      try {
        return await apiRequest<T>(path, {
          ...options,
          accessToken: auth.accessToken,
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        const refreshed = await apiRequest<AuthSession>("/auth/refresh", {
          method: "POST",
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
      withAuth<Vehicle[]>("/vehicles"),
      withAuth<DiagnosticRequestSummary[]>("/diagnostic-requests"),
    ]);

    setVehicles(vehicleList);
    setRequests(requestList);

    setSelectedVehicleIdState((current) => {
      if (current && vehicleList.some((item) => item.id === current))
        return current;
      return vehicleList[0]?.id ?? "";
    });

    setSelectedRequestIdState((current) => {
      if (current && requestList.some((item) => item.id === current))
        return current;
      return requestList[0]?.id ?? "";
    });
  }, [auth, withAuth]);

  const refreshAdminWorkspace = useCallback(async () => {
    if (!auth || auth.user.role !== "ADMIN") {
      setAdminDashboard(null);
      setAdminUsers([]);
      setAdminDevices([]);
      return;
    }

    setAdminLoading(true);
    setWorkspaceError(null);
    try {
      const [dashboard, users, devices] = await Promise.all([
        withAuth<AdminDashboardStats>("/admin/dashboard"),
        withAuth<AdminUserRow[]>("/admin/users"),
        withAuth<AdminDeviceRow[]>("/admin/devices"),
      ]);

      setAdminDashboard(dashboard);
      setAdminUsers(users);
      setAdminDevices(devices);
    } finally {
      setAdminLoading(false);
    }
  }, [auth, withAuth]);

  useEffect(() => {
    if (!auth) {
      setInitializing(false);
      return;
    }

    let active = true;
    void (async () => {
      try {
        await withAuth<AuthUser>("/auth/me");
        await Promise.all([refreshWorkspace(), refreshAdminWorkspace()]);
      } catch (error) {
        if (active) {
          setAuth(null);
          setWorkspaceError(
            error instanceof Error ? error.message : "Authentication failed.",
          );
        }
      } finally {
        if (active) setInitializing(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [auth, refreshAdminWorkspace, refreshWorkspace, withAuth]);

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
        const detail = await withAuth<DiagnosticRequestDetail>(
          `/diagnostic-requests/${selectedRequestId}`,
        );
        if (cancelled) return;
        setRequestDetail(detail);

        const summary = requests.find((item) => item.id === selectedRequestId);
        if (summary?.hasReport) {
          const report = await withAuth<ReportResponse>(
            `/reports/${selectedRequestId}`,
          );
          if (!cancelled) {
            setReportDetail(report);
          }
        } else {
          setReportDetail(null);
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(
            error instanceof Error
              ? error.message
              : "Unable to load the selected diagnostic request.",
          );
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

  const updateVehicleDraft = useCallback(
    (key: keyof VehicleDraft, value: string) => {
      setVehicleDraft((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const authenticate = useCallback(
    async (
      mode: AuthMode,
      email: string,
      password: string,
      displayName?: string,
    ) => {
      setBusy(true);
      setWorkspaceError(null);
      try {
        const session =
          mode === "register"
            ? await apiRequest<AuthSession>("/auth/register", {
                method: "POST",
                body: JSON.stringify({ email, password, displayName }),
              })
            : await apiRequest<AuthSession>("/auth/login", {
                method: "POST",
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
    setAdminDashboard(null);
    setAdminUsers([]);
    setAdminDevices([]);
    setSelectedVehicleIdState("");
    setSelectedRequestIdState("");
    setToast("Session closed.");
  }, []);

  const createVehicle = useCallback(async () => {
    setBusy(true);
    setWorkspaceError(null);
    try {
      const created = await withAuth<Vehicle>("/vehicles", {
        method: "POST",
        body: JSON.stringify({
          vin: vehicleDraft.vin.trim() || undefined,
          make: vehicleDraft.make.trim() || undefined,
          model: vehicleDraft.model.trim() || undefined,
          year: vehicleDraft.year.trim()
            ? Number(vehicleDraft.year.trim())
            : undefined,
        }),
      });

      await refreshWorkspace();
      setVehicleDraft(initialVehicleDraft);
      startTransition(() => {
        setSelectedVehicleIdState(created.id);
      });
      setToast("Vehicle created successfully.");
    } finally {
      setBusy(false);
    }
  }, [refreshWorkspace, vehicleDraft, withAuth]);

  const attachOrUpdateDevice = useCallback(
    async (vehicleId: string) => {
      const draft = deviceDrafts[vehicleId];
      if (!draft?.deviceCode.trim()) {
        setWorkspaceError("Device code is required.");
        return;
      }

      setBusy(true);
      setWorkspaceError(null);
      try {
        await withAuth(`/vehicles/${vehicleId}/devices`, {
          method: "POST",
          body: JSON.stringify({
            deviceCode: draft.deviceCode.trim(),
            firmwareVersion: draft.firmwareVersion.trim() || undefined,
          }),
        });
        await refreshWorkspace();
        setToast("Device updated successfully.");
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
          method: "POST",
        });
        setToast("Capability discovery triggered.");
      } finally {
        setBusy(false);
      }
    },
    [withAuth],
  );

  const detachDevice = useCallback(
    async (vehicleId: string) => {
      setBusy(true);
      setWorkspaceError(null);
      try {
        await withAuth(`/vehicles/${vehicleId}/devices`, {
          method: "DELETE",
        });
        setDeviceDrafts((current) => {
          const next = { ...current };
          delete next[vehicleId];
          return next;
        });
        await refreshWorkspace();
        setToast("Device unlinked successfully.");
      } finally {
        setBusy(false);
      }
    },
    [refreshWorkspace, withAuth],
  );

  const fetchSupportedPids = useCallback(
    async (vehicleId: string) => {
      setBusy(true);
      setWorkspaceError(null);
      try {
        const payload = await withAuth<SupportedPidResponse>(
          `/vehicles/${vehicleId}/supported-pids`,
        );
        setSupportedByVehicle((current) => ({
          ...current,
          [vehicleId]: payload,
        }));
        setToast("Supported signal matrix loaded.");
      } finally {
        setBusy(false);
      }
    },
    [withAuth],
  );

  const createDiagnosticRequest = useCallback(async () => {
    if (!selectedVehicleId) {
      setWorkspaceError("Select a vehicle before creating a request.");
      return;
    }
    if (!complaintText.trim()) {
      setWorkspaceError("Diagnostic complaint cannot be empty.");
      return;
    }

    setBusy(true);
    setWorkspaceError(null);
    try {
      const response = await withAuth<{ requestId: string }>(
        "/diagnostic-requests",
        {
          method: "POST",
          body: JSON.stringify({
            vehicleId: selectedVehicleId,
            complaintText: complaintText.trim(),
          }),
        },
      );
      await refreshWorkspace();
      setComplaintText("");
      startTransition(() => {
        setSelectedRequestIdState(response.requestId);
      });
      setToast("Diagnostic request submitted.");
    } finally {
      setBusy(false);
    }
  }, [complaintText, refreshWorkspace, selectedVehicleId, withAuth]);

  const createAdminUser = useCallback(async () => {
    setBusy(true);
    setWorkspaceError(null);
    try {
      await withAuth("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: adminUserDraft.email.trim(),
          displayName: adminUserDraft.displayName.trim(),
          password: adminUserDraft.password,
          role: adminUserDraft.role,
        }),
      });
      setAdminUserDraft(initialAdminUserDraft);
      await refreshAdminWorkspace();
      setToast("Admin user record created.");
    } finally {
      setBusy(false);
    }
  }, [adminUserDraft, refreshAdminWorkspace, withAuth]);

  const updateAdminUser = useCallback(
    async (userId: string, patch: Partial<AdminUserDraft>) => {
      setBusy(true);
      setWorkspaceError(null);
      try {
        const payload: Record<string, unknown> = {};
        if (typeof patch.email === "string") payload.email = patch.email.trim();
        if (typeof patch.displayName === "string") payload.displayName = patch.displayName.trim();
        if (typeof patch.password === "string" && patch.password.trim()) payload.password = patch.password;
        if (typeof patch.role === "string") payload.role = patch.role;

        await withAuth(`/admin/users/${userId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        await refreshAdminWorkspace();
        setToast("User updated.");
      } finally {
        setBusy(false);
      }
    },
    [refreshAdminWorkspace, withAuth],
  );

  const deleteAdminUser = useCallback(
    async (userId: string) => {
      setBusy(true);
      setWorkspaceError(null);
      try {
        await withAuth(`/admin/users/${userId}`, {
          method: "DELETE",
        });
        await refreshAdminWorkspace();
        setToast("User deleted.");
      } finally {
        setBusy(false);
      }
    },
    [refreshAdminWorkspace, withAuth],
  );

  const createAdminDevice = useCallback(async () => {
    setBusy(true);
    setWorkspaceError(null);
    try {
      await withAuth("/admin/devices", {
        method: "POST",
        body: JSON.stringify({
          deviceCode: adminDeviceDraft.deviceCode.trim(),
          serialNumber: adminDeviceDraft.serialNumber.trim() || undefined,
          firmwareVersion: adminDeviceDraft.firmwareVersion.trim() || undefined,
          status: adminDeviceDraft.status,
        }),
      });
      setAdminDeviceDraft(initialAdminDeviceDraft);
      await refreshAdminWorkspace();
      setToast("System device created.");
    } finally {
      setBusy(false);
    }
  }, [adminDeviceDraft, refreshAdminWorkspace, withAuth]);

  const updateAdminDevice = useCallback(
    async (deviceId: string, patch: Partial<AdminDeviceDraft>) => {
      setBusy(true);
      setWorkspaceError(null);
      try {
        const payload: Record<string, unknown> = {};
        if (typeof patch.deviceCode === "string") payload.deviceCode = patch.deviceCode.trim();
        if (typeof patch.serialNumber === "string") payload.serialNumber = patch.serialNumber.trim() || undefined;
        if (typeof patch.firmwareVersion === "string") payload.firmwareVersion = patch.firmwareVersion.trim() || undefined;
        if (typeof patch.status === "string") payload.status = patch.status;

        await withAuth(`/admin/devices/${deviceId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        await refreshAdminWorkspace();
        await refreshWorkspace();
        setToast("Device inventory updated.");
      } finally {
        setBusy(false);
      }
    },
    [refreshAdminWorkspace, refreshWorkspace, withAuth],
  );

  const deleteAdminDevice = useCallback(
    async (deviceId: string) => {
      setBusy(true);
      setWorkspaceError(null);
      try {
        await withAuth(`/admin/devices/${deviceId}`, {
          method: "DELETE",
        });
        await Promise.all([refreshAdminWorkspace(), refreshWorkspace()]);
        setToast("Device deleted from inventory.");
      } finally {
        setBusy(false);
      }
    },
    [refreshAdminWorkspace, refreshWorkspace, withAuth],
  );

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
      adminDashboard,
      adminUsers,
      adminDevices,
      adminLoading,
      adminUserDraft,
      adminDeviceDraft,
      deviceDrafts,
      complaintText,
      vehicleDraft,
      setToast,
      setSelectedVehicleId,
      setSelectedRequestId,
      setComplaintText,
      setAdminUserDraft,
      setAdminDeviceDraft,
      updateVehicleDraft,
      setDeviceDrafts,
      authenticate,
      logout,
      refreshWorkspace,
      createVehicle,
      attachOrUpdateDevice,
      detachDevice,
      triggerCapabilityDiscovery,
      fetchSupportedPids,
      createDiagnosticRequest,
      refreshAdminWorkspace,
      createAdminUser,
      updateAdminUser,
      deleteAdminUser,
      createAdminDevice,
      updateAdminDevice,
      deleteAdminDevice,
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
      adminDashboard,
      adminUsers,
      adminDevices,
      adminLoading,
      adminUserDraft,
      adminDeviceDraft,
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
      detachDevice,
      triggerCapabilityDiscovery,
      fetchSupportedPids,
      createDiagnosticRequest,
      refreshAdminWorkspace,
      createAdminUser,
      updateAdminUser,
      deleteAdminUser,
      createAdminDevice,
      updateAdminDevice,
      deleteAdminDevice,
    ],
  );

  return (
    <AppModelContext.Provider value={value}>
      {children}
    </AppModelContext.Provider>
  );
}

export function useAppModel(): AppModelValue {
  const value = useContext(AppModelContext);
  if (!value) {
    throw new Error("useAppModel must be used within AppProvider.");
  }
  return value;
}
