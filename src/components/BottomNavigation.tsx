import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Dumbbell, Plus, List, User } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  /** Which pathnames light this tab (default: NavLink's own matching). */
  isActive?: (pathname: string) => boolean;
}

export interface BottomNavigationProps {
  className?: string;
}

const iconProps = { className: 'h-6 w-6', strokeWidth: 1.8, 'aria-hidden': true } as const;

/**
 * Workout goes to the live workout when one is running, otherwise to the
 * "Build a workout" chooser (so it's never an empty screen). Build goes
 * straight to the custom builder.
 */
function navItems(hasActiveWorkout: boolean): NavItem[] {
  return [
    { path: '/', label: 'Today', icon: <Home {...iconProps} /> },
    {
      path: hasActiveWorkout ? '/workout' : '/build',
      label: 'Workout',
      icon: <Dumbbell {...iconProps} />,
      isActive: (p) => p.startsWith('/workout') || p === '/build' || p === '/build/',
    },
    {
      path: '/build/custom',
      label: 'Build',
      icon: <Plus {...iconProps} />,
      isActive: (p) => p.startsWith('/build/custom') || p.startsWith('/build/shared'),
    },
    { path: '/exercises', label: 'Library', icon: <List {...iconProps} /> },
    { path: '/profile', label: 'Profile', icon: <User {...iconProps} /> },
  ];
}

/**
 * Tempo bottom nav: flat on the navy ground, a single hairline above, and the
 * active tab marked by amber alone (no pill, no motion) — the nav should be
 * the quietest thing on screen.
 */
export const BottomNavigation: React.FC<BottomNavigationProps> = ({ className }) => {
  const hasActiveWorkout = useAppSelector((s) => !!s.workout.activeWorkout);
  const { pathname } = useLocation();
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
        {navItems(hasActiveWorkout).map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive: linkActive }) => {
              const isActive = item.isActive ? item.isActive(pathname) : linkActive;
              return cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl',
                'text-caption transition-colors duration-snap touch-manipulation',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isActive
                  ? 'font-semibold text-accent'
                  : 'font-medium text-ink-muted hover:text-ink'
              );
            }}
          >
            {item.icon}
            <span className="leading-none">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
