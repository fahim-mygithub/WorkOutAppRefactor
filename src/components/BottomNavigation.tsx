import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Dumbbell, Plus, List, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export interface BottomNavigationProps {
  className?: string;
}

const iconProps = { className: 'h-6 w-6', strokeWidth: 1.8, 'aria-hidden': true } as const;

const navItems: NavItem[] = [
  { path: '/', label: 'Today', icon: <Home {...iconProps} /> },
  { path: '/workout', label: 'Workout', icon: <Dumbbell {...iconProps} /> },
  { path: '/build', label: 'Build', icon: <Plus {...iconProps} /> },
  { path: '/exercises', label: 'Library', icon: <List {...iconProps} /> },
  { path: '/profile', label: 'Profile', icon: <User {...iconProps} /> },
];

/**
 * Tempo bottom nav: flat on the navy ground, a single hairline above, and the
 * active tab marked by amber alone (no pill, no motion) — the nav should be
 * the quietest thing on screen.
 */
export const BottomNavigation: React.FC<BottomNavigationProps> = ({ className }) => {
  return (
    <nav
      aria-label="Main"
      className={cn(
        // Plain flex sibling of the shell's scroll container — NOT fixed/absolute.
        'shrink-0 bg-surface',
        'border-t border-hairline px-2 pt-1.5',
        'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        className
      )}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl',
                'text-caption transition-colors duration-snap touch-manipulation',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isActive
                  ? 'font-semibold text-accent'
                  : 'font-medium text-ink-muted hover:text-ink'
              )
            }
          >
            {item.icon}
            <span className="leading-none">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
