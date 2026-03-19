import { Route, Switch, Redirect } from 'wouter';
import { AuthedLayout } from './components/AuthedLayout';
import { AuthPage } from './pages/Auth';
import { SetupPage } from './pages/Setup';
import { CalendarPage } from './pages/Calendar';
import { EventsPage } from './pages/Events';
import { ProfilePage } from './pages/Profile';
import { AdminPage } from './pages/Admin';
import { useAuth } from './state/auth';

function AuthedApp() {
  const { user } = useAuth();

  // If profile not complete, send to setup
  if (!user?.full_name) {
    return <SetupPage />;
  }

  return (
    <AuthedLayout>
      <Switch>
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/events" component={EventsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/admin">
          {user.role === 'admin' ? <AdminPage /> : <Redirect to="/events" />}
        </Route>
        <Route>
          <Redirect to="/calendar" />
        </Route>
      </Switch>
    </AuthedLayout>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1220]">
        <div className="text-sm text-white/60">Loading…</div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Auth routes — redirect to app if already logged in */}
      <Route path="/">
        {user ? <Redirect to="/calendar" /> : <AuthPage />}
      </Route>
      <Route path="/auth">
        {user ? <Redirect to="/calendar" /> : <AuthPage />}
      </Route>

      {/* Signup with invite token */}
      <Route path="/signup">
        {user ? <Redirect to="/calendar" /> : <AuthPage />}
      </Route>

      {/* All authenticated routes */}
      <Route>
        {user ? <AuthedApp /> : <Redirect to="/" />}
      </Route>
    </Switch>
  );
}
