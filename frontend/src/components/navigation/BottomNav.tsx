import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

// Simple SVG icons — no external dependency
const JournalIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#C4704B' : '#9B9B9B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="13" y2="11" />
  </svg>
);

const DashboardIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#C4704B' : '#9B9B9B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const ActionsIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#C4704B' : '#9B9B9B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#C4704B' : '#9B9B9B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { key: 'journal', label: 'Journal', path: '/journal', icon: <JournalIcon active={false} /> },
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon active={false} /> },
  { key: 'actions', label: 'Actions', path: '/actions', icon: <ActionsIcon active={false} /> },
  { key: 'profile', label: 'Profile', path: '/profile', icon: <ProfileIcon active={false} /> },
];

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
    <nav className="bg-journal-surface border-t border-journal-border safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center flex-1 h-full transition-colors"
            >
              {/* Render icon with active prop */}
              {item.key === 'journal' && <JournalIcon active={active} />}
              {item.key === 'dashboard' && <DashboardIcon active={active} />}
              {item.key === 'actions' && <ActionsIcon active={active} />}
              {item.key === 'profile' && <ProfileIcon active={active} />}
              <span
                className={`text-[10px] mt-0.5 font-medium transition-colors ${
                  active ? 'text-journal-accent' : 'text-journal-text-muted'
                }`}
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
