import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Dumbbell, Plus, List, User } from 'lucide-react';
import { motion as fmotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { motion as motionTokens } from '@/lib/motion';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export interface BottomNavigationProps {
  className?: string;
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Home',
    icon: <Home className="w-5 h-5" strokeWidth={2} />
  },
  {
    path: '/workout',
    label: 'Workout',
    icon: <Dumbbell className="w-5 h-5" strokeWidth={2} />
  },
  {
    path: '/build',
    label: 'Build',
    icon: <Plus className="w-5 h-5" strokeWidth={2} />
  },
  {
    path: '/exercises',
    label: 'Directory',
    icon: <List className="w-5 h-5" strokeWidth={2} />
  },
  {
    path: '/profile',
    label: 'Profile',
    icon: <User className="w-5 h-5" strokeWidth={2} />
  }
];

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ className }) => {
  return (
    <nav
      className={cn(
        // Plain flex sibling of the shell's scroll container — NOT fixed/absolute.
        'shrink-0',
        'bg-surface',
        'px-4 pt-2 border-t border-border',
        'pb-[env(safe-area-inset-bottom)]',
        className
      )}
    >
      <div className="flex justify-around items-stretch mx-auto max-w-md">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center gap-1',
                'min-w-[60px] min-h-[48px] flex-1 px-3 py-2 rounded-lg',
                'transition-colors duration-snap ease-spring-soft',
                'active:scale-95 touch-manipulation',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                isActive ? 'text-accent' : 'text-ink-subtle hover:text-ink-muted'
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator pill — animates between tabs via shared layoutId. */}
                {isActive && (
                  <fmotion.span
                    layoutId="bottom-nav-indicator"
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-lg bg-accent/10"
                    transition={{
                      duration: motionTokens.duration.smooth,
                      ease: motionTokens.ease.springSoft,
                    }}
                  />
                )}
                <span className="relative">{item.icon}</span>
                <span
                  className={cn(
                    'relative text-caption leading-none',
                    isActive ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
