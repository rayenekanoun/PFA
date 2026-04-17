import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { SIDEBAR_STORAGE_KEY } from "./lib";
import { useAppModel } from "./useAppModel";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { to: "/overview", label: "Overview", icon: "◩" },
  { to: "/cars", label: "Cars", icon: "◻" },
  { to: "/devices", label: "Devices", icon: "◎" },
  { to: "/conversations", label: "Conversations", icon: "◍" },
  { to: "/reports", label: "Reports", icon: "▤" },
  { to: "/settings", label: "Settings", icon: "◌" },
];

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/overview": {
    title: "Operational Overview",
    subtitle: "Daily fleet and diagnostics signal in one calm workspace.",
  },
  "/cars": {
    title: "Cars",
    subtitle: "Vehicle registration and detail context.",
  },
  "/devices": {
    title: "Devices",
    subtitle: "Diagnostic hardware linkage and signal discovery.",
  },
  "/conversations": {
    title: "Conversations",
    subtitle: "Structured diagnostic request and execution flow.",
  },
  "/reports": {
    title: "Reports",
    subtitle: "Finalized findings and downloadable report artifacts.",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Account and workspace preferences.",
  },
};

function readSidebarPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell() {
  const location = useLocation();
  const {
    auth,
    toast,
    workspaceError,
    setToast,
    refreshWorkspace,
    logout,
    busy,
  } = useAppModel();
  const [collapsed, setCollapsed] = useState(readSidebarPreference);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const activeMeta = useMemo(
    () => pageMeta[location.pathname] ?? pageMeta["/overview"],
    [location.pathname],
  );

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="brand-block">
          <span className="brand-glyph">CD</span>
          {!collapsed && (
            <div>
              <p className="brand-kicker">Connected Vehicle</p>
              <h2>Diagnostics Ops</h2>
            </div>
          )}
        </div>

        <button
          className="collapse-button"
          onClick={() => setCollapsed((value) => !value)}
          type="button"
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
              key={item.to}
              to={item.to}
            >
              <span className="nav-icon" aria-hidden>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div>
            <p className="header-kicker">Platform</p>
            <h1>{activeMeta.title}</h1>
            <p className="header-subtitle">{activeMeta.subtitle}</p>
          </div>

          <div className="header-actions">
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => void refreshWorkspace()}
              type="button"
            >
              Refresh
            </button>
            <div className="user-pill" title={auth?.user.email}>
              <span>{auth?.user.displayName ?? "User"}</span>
              <small>{auth?.user.role ?? "USER"}</small>
            </div>
            <button className="button ghost" onClick={logout} type="button">
              Sign out
            </button>
          </div>
        </header>

        {workspaceError && <p className="banner error">{workspaceError}</p>}
        {toast && (
          <p
            className="banner success"
            onClick={() => setToast(null)}
            role="status"
          >
            {toast}
          </p>
        )}

        <section className="page-content">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
