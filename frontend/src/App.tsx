import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import "./index.css";
import { AppShell } from "./app/AppShell";
import {
  AuthPage,
  CarsPage,
  ConversationsPage,
  DevicesPage,
  OverviewPage,
  ReportsPage,
  SettingsPage,
} from "./app/pages";
import { AppProvider, useAppModel } from "./app/useAppModel";

function AuthGate() {
  const { auth, initializing } = useAppModel();
  if (initializing)
    return <div className="boot-screen">Loading diagnostics workspace...</div>;
  return auth ? <Navigate replace to="/overview" /> : <Outlet />;
}

function PrivateGate() {
  const { auth, initializing } = useAppModel();
  if (initializing)
    return <div className="boot-screen">Loading diagnostics workspace...</div>;
  return auth ? <AppShell /> : <Navigate replace to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthGate />}>
        <Route element={<AuthPage mode="login" />} path="/login" />
        <Route element={<AuthPage mode="register" />} path="/signup" />
      </Route>

      <Route element={<PrivateGate />}>
        <Route element={<Navigate replace to="/overview" />} path="/" />
        <Route element={<OverviewPage />} path="/overview" />
        <Route element={<CarsPage />} path="/cars" />
        <Route element={<DevicesPage />} path="/devices" />
        <Route element={<ConversationsPage />} path="/conversations" />
        <Route element={<ReportsPage />} path="/reports" />
        <Route element={<SettingsPage />} path="/settings" />
      </Route>

      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
