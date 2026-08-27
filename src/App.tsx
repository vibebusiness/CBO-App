import React from 'react';
import { Route, Switch, Redirect, useRoute } from 'wouter';
import { AuthedLayout } from './components/AuthedLayout';
import { useAuth } from './state/auth';

const AuthPage = React.lazy(() => import('./pages/Auth').then((module) => ({ default: module.AuthPage })));
const SetupPage = React.lazy(() => import('./pages/Setup').then((module) => ({ default: module.SetupPage })));
const CalendarPage = React.lazy(() => import('./pages/Calendar').then((module) => ({ default: module.CalendarPage })));
const EventsPage = React.lazy(() => import('./pages/Events').then((module) => ({ default: module.EventsPage })));
const EventDetailPage = React.lazy(() => import('./pages/EventDetail').then((module) => ({ default: module.EventDetailPage })));
const EventAttendeesPage = React.lazy(() => import('./pages/EventAttendees').then((module) => ({ default: module.EventAttendeesPage })));
const ProfilePage = React.lazy(() => import('./pages/Profile').then((module) => ({ default: module.ProfilePage })));
const AdminPage = React.lazy(() => import('./pages/Admin').then((module) => ({ default: module.AdminPage })));
const AdminEventEditPage = React.lazy(() => import('./pages/AdminEventEdit').then((module) => ({ default: module.AdminEventEditPage })));
const DoorCheckPage = React.lazy(() => import('./pages/DoorCheck').then((module) => ({ default: module.DoorCheckPage })));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPassword').then((module) => ({ default: module.ResetPasswordPage })));

function StartupScreen({
  error,
  onRetry,
  onSignOut,
}: {
  error?: string | null;
  onRetry?: () => void;
  onSignOut?: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 text-white">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
        <img
          src="/cbo-logo.png"
          alt="Charlotte Business Owners"
          className="mx-auto h-24 w-24 rounded-2xl bg-white object-contain p-2 shadow-lg"
        />

        {error ? (
          <div className="mt-6" role="alert">
            <h1 className="text-xl font-bold">We couldn't finish opening CBO</h1>
            <p className="mt-2 text-sm leading-6 text-slate-200">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="mt-3 px-4 py-2 text-sm font-semibold text-slate-200 underline decoration-slate-500 underline-offset-4 hover:text-white"
            >
              Return to sign in
            </button>
          </div>
        ) : (
          <div className="mt-6" role="status" aria-live="polite">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <h1 className="mt-5 text-xl font-bold">Opening CBO…</h1>
            <p className="mt-2 text-sm text-slate-300">Connecting to your events and community</p>
          </div>
        )}
      </section>
    </main>
  );
}

function AuthedApp() {
  const { user } = useAuth();
  const [isDoorRoute] = useRoute('/door/:id');

  if (!user?.full_name) {
    return <SetupPage />;
  }

  // Door check view is full-screen — no nav layout
  if (isDoorRoute) {
    return (
      <Switch>
        <Route path="/door/:id">
          {user.role === 'admin' ? <DoorCheckPage /> : <Redirect to="/events" />}
        </Route>
      </Switch>
    );
  }

  return (
    <AuthedLayout>
      <Switch>
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/events/:id/attendees" component={EventAttendeesPage} />
        <Route path="/events/:id" component={EventDetailPage} />
        <Route path="/events" component={EventsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/admin/events/:id/edit">
          {user.role === 'admin' ? <AdminEventEditPage /> : <Redirect to="/events" />}
        </Route>
        <Route path="/admin">
          {user.role === 'admin' ? <AdminPage /> : <Redirect to="/events" />}
        </Route>
        <Route>
          <Redirect to="/events" />
        </Route>
      </Switch>
    </AuthedLayout>
  );
}

export default function App() {
  const { user, loading, error, retry, signOut } = useAuth();

  if (loading) {
    return <StartupScreen />;
  }

  if (error && !user) {
    return <StartupScreen error={error} onRetry={() => void retry()} onSignOut={signOut} />;
  }

  return (
    <React.Suspense fallback={<StartupScreen />}>
      <Switch>
        <Route path="/">
          {user ? <Redirect to="/events" /> : <AuthPage />}
        </Route>
        <Route path="/auth">
          {user ? <Redirect to="/events" /> : <AuthPage />}
        </Route>
        <Route path="/signup">
          {user ? <Redirect to="/events" /> : <AuthPage />}
        </Route>
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route>
          {user ? <AuthedApp /> : <Redirect to="/" />}
        </Route>
      </Switch>
    </React.Suspense>
  );
}
