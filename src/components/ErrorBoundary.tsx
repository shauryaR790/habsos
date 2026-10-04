import { Component, type ReactNode } from 'react';
import { Button } from './Button';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message || 'Something went wrong.' };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="cust narrow stack">
        <h1>Something went wrong</h1>
        <p>{this.state.error}</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </main>
    );
  }
}
