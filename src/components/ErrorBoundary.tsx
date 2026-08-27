import React from 'react';

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, details: React.ErrorInfo) {
    console.error('CBO interface error:', error, details.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-2xl">
          <h1 className="text-xl font-bold">CBO hit an unexpected problem</h1>
          <p className="mt-2 text-sm leading-6 text-slate-200">Your information is safe. Reload to open a fresh copy of the app.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900"
          >
            Reload CBO
          </button>
        </section>
      </main>
    );
  }
}
