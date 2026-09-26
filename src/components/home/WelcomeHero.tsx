import { Link } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
};

/**
 * Home context line (Tempo): today's date on the left, the user's initial on
 * the right linking to Profile. Deliberately quiet — the hero below it
 * (TodayWorkout) carries the display title.
 */
export function WelcomeHero() {
  const user = useAppSelector((state) => state.user.profile);
  const firstName = user?.displayName?.split(' ')[0];
  const initial = (firstName?.[0] ?? '?').toUpperCase();
  const today = new Date().toLocaleDateString(undefined, DATE_FORMAT);

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-body-sm text-ink-muted">{today}</p>
        {firstName && (
          <p className="truncate text-body-sm font-semibold text-ink">Hi, {firstName}</p>
        )}
      </div>
      <Link
        to="/profile"
        aria-label="Profile"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-raised font-display text-body text-ink transition-colors hover:bg-surface-raised/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {initial}
      </Link>
    </header>
  );
}
