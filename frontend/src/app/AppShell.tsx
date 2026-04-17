import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { SIDEBAR_STORAGE_KEY } from "./lib";
import { useAppModel } from "./useAppModel";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const baseNavItems: NavItem[] = [
  {
    to: "/overview",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="2" y="2" width="7" height="7" rx="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: "/cars",
    label: "Vehicles",
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
    to: "/devices",
    label: "Devices",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="14" height="12" rx="2" />
        <circle cx="10" cy="10" r="2.5" />
        <path d="M10 4v2M10 14v2M3 10h2M15 10h2" />
      </svg>
    ),
  },
  {
    to: "/conversations",
    label: "Diagnostics",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 4h14v10H3z" rx="1.5" />
        <path d="M6 16l4 2 4-2" />
        <path d="M6 8h8M6 11h5" />
      </svg>
    ),
  },
  {
    to: "/reports",
    label: "Reports",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M5 2h7l4 4v13H5V2z" />
        <path d="M12 2v4h4" />
        <path d="M7 9h6M7 12h6M7 15h3" />
      </svg>
    ),
  },
];

const pageMeta: Record<string, { title: string; kicker: string }> = {
  "/overview":      { title: "Operational Overview",    kicker: "Dashboard" },
  "/cars":          { title: "Vehicle Registry",         kicker: "Vehicles" },
  "/devices":       { title: "Diagnostic Devices",       kicker: "Hardware" },
  "/conversations": { title: "Diagnostic Requests",      kicker: "Diagnostics" },
  "/reports":       { title: "Report Archive",           kicker: "Reports" },
  "/admin":         { title: "Admin Operations Center",  kicker: "Admin" },
  "/settings":      { title: "Admin Operations Center",  kicker: "Admin" },
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
  const { auth, toast, workspaceError, setToast, refreshWorkspace, logout, busy } =
    useAppModel();
  const [collapsed, setCollapsed] = useState(readSidebarPreference);
  const navItems = useMemo(() => {
    if (auth?.user.role !== "ADMIN") {
      return baseNavItems;
    }

    return [
      ...baseNavItems,
      {
        to: "/admin",
        label: "Admin",
        icon: (
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M10 2l2.6 5.3 5.9.9-4.2 4.1 1 5.7L10 15.2 4.7 18l1-5.7L1.5 8.2l5.9-.9L10 2z" />
          </svg>
        ),
      },
    ];
  }, [auth?.user.role]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const activeMeta = useMemo(
    () => pageMeta[location.pathname] ?? pageMeta["/overview"],
    [location.pathname],
  );

  const initials = (auth?.user.displayName ?? auth?.user.email ?? "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
              <path d="M12 12L2 7M12 12l10-5M12 12v10" />
            </svg>
          </div>
          {!collapsed && (
            <div className="brand-name">
              <h2>DiagOps</h2>
              <small>Connected Vehicle</small>
            </div>
          )}
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon" aria-hidden>{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="collapse-button"
            onClick={() => setCollapsed((v) => !v)}
            type="button"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 4l4 4-4 4" />
              </svg>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M10 4L6 8l4 4" />
                </svg>
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="header-left">
            <div>
              <span className="header-kicker">{activeMeta.kicker}</span>
              <h1>{activeMeta.title}</h1>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => void refreshWorkspace()}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M13.5 8A5.5 5.5 0 112.5 5" />
                <path d="M2.5 2v3h3" />
              </svg>
              Refresh
            </button>

            <div className="user-pill" title={auth?.user.email}>
              <div className="user-avatar">{initials}</div>
              <div className="user-pill-info">
                <span className="user-pill-name">{auth?.user.displayName ?? "User"}</span>
                <span className="user-pill-role">{auth?.user.role ?? "USER"}</span>
              </div>
            </div>

            <button className="button ghost" onClick={logout} type="button">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 8H3M7 5l-3 3 3 3" />
                <path d="M6 3H13v10H6" />
              </svg>
              Sign out
            </button>
          </div>
        </header>

        {workspaceError && <p className="banner error">{workspaceError}</p>}
        {toast && (
          <p className="banner success" onClick={() => setToast(null)} role="status">
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
