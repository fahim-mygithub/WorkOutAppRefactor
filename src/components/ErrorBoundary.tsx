import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      // Tempo fallback: a calm hero that says what happened and the one thing
      // to do about it: reload.
      return (
        this.props.fallback ?? (
          <div role="alert" className="flex h-[100svh] flex-col justify-center bg-surface px-4">
            <div className="mx-auto w-full max-w-sm">
              <p className="text-body-sm text-ink-muted">Something broke</p>
              <h1 className="mt-1 font-display text-display text-ink">This screen stopped working</h1>
              <p className="mt-3 max-w-[34ch] text-body text-ink-muted">
                Reload the app to try again.
              </p>
              <Button size="xl" className="mt-8" onClick={() => window.location.reload()}>
                Reload app
              </Button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
