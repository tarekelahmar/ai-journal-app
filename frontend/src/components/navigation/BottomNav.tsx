import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  key: string;
  label: string;
  path: string;
}

// ── SVG Icons (22px, currentColor) ──────────────────────────────

const JournalIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="13" y2="11" />
  </svg>
);

const DashboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const ActionsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ProfileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ICON_MAP: Record<string, React.FC> = {
  journal: JournalIcon,
  dashboard: DashboardIcon,
  actions: ActionsIcon,
  profile: ProfileIcon,
};

const NAV_ITEMS: NavItem[] = [
  { key: 'journal', label: 'Journal', path: '/journal' },
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'actions', label: 'Actions', path: '/actions' },
  { key: 'profile', label: 'Profile', path: '/profile' },
];

// ── Colors ───────────────────────────────────────────────────────

const BAR_BG = '#2A2520';       // warm dark
const INACTIVE_COLOR = '#8C8278'; // warm grey on dark bg
const ACTIVE_PILL_BG = '#FAF8F5'; // cream
const ACTIVE_COLOR = '#2A2520';   // dark on cream pill

// ── Component ────────────────────────────────────────────────────

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/journal') {
      return location.pathname === '/journal' || location.pathname === '/score';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Pill bar — auto-width on desktop, near-full on mobile */}
      <div
        className="flex items-center mx-4 sm:mx-auto"
        style={{
          backgroundColor: BAR_BG,
          borderRadius: 30,
          padding: '6px 10px',
          gap: 4,
          maxWidth: 680,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          const Icon = ICON_MAP[item.key];

          return (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className="relative flex items-center justify-center outline-none border-none cursor-pointer shrink-0"
              style={{
                backgroundColor: active ? ACTIVE_PILL_BG : 'transparent',
                color: active ? ACTIVE_COLOR : INACTIVE_COLOR,
                borderRadius: 24,
                padding: active ? '6px 16px' : '6px 14px',
                gap: active ? 8 : 0,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                minHeight: 36,
              }}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon />
              {/* Label — only for active tab */}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: ACTIVE_COLOR,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  maxWidth: active ? 80 : 0,
                  opacity: active ? 1 : 0,
                  transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
