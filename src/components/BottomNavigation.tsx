import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Dumbbell, Plus, List, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKeyboardDetection } from '../hooks/useKeyboardDetection';
import { useIOSKeyboardFix } from '../hooks/useIOSKeyboardFix';

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
  const { isVisible: isKeyboardVisible } = useKeyboardDetection();
  const {
    isIOSSafari,
    shouldUseAbsolutePositioning,
    calculatedBottom,
    isKeyboardVisible: isIOSKeyboardVisible
  } = useIOSKeyboardFix();

  // For iOS Safari, use the iOS-specific keyboard detection
  const keyboardVisible = isIOSSafari ? isIOSKeyboardVisible : isKeyboardVisible;

  // Generate dynamic styles for iOS absolute positioning
  const dynamicStyles = isIOSSafari && shouldUseAbsolutePositioning ? {
    position: 'absolute' as const,
    top: `${calculatedBottom - 72}px`, // 72px is approximate height of nav
    left: 0,
    right: 0,
    bottom: 'auto',
  } : {};

  return (
    <nav
      className={cn(
        // Use different base classes based on iOS Safari detection
        isIOSSafari && shouldUseAbsolutePositioning
          ? 'ios-absolute-bottom-nav'
          : 'mobile-fixed-bottom',
        'bg-black backdrop-blur-sm',
        'px-4 pt-2 border-t border-gray-800',
        'h-[calc(4.5rem+env(safe-area-inset-bottom))]',
        'pb-[env(safe-area-inset-bottom)]',
        'bottom-nav-keyboard-aware',
        'bottom-nav-pwa',
        keyboardVisible ? 'keyboard-visible' : 'keyboard-hidden',
        className
      )}
      style={dynamicStyles}
    >
      <div className="flex justify-around items-center mx-auto max-w-md">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center',
                'px-3 py-2 rounded-xl',
                'transition-all duration-200',
                'min-w-[60px] flex-1',
                'active:scale-95 touch-manipulation',
                'group',
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-300'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'relative mb-1 transition-all duration-200',
                  isActive ? 'scale-110' : 'group-hover:scale-105'
                )}>
                  {item.icon}
                  {isActive && (
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full" />
                  )}
                </div>
                <span className={cn(
                  'relative text-[10px] leading-none transition-all duration-200',
                  isActive ? 'font-medium text-white' : 'font-normal'
                )}>
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