import { Route, Switch, Redirect, useRoute } from 'wouter';
import { AuthedLayout } from './components/AuthedLayout';
import { AuthPage } from './pages/Auth';
import { SetupPage } from './pages/Setup';
import { CalendarPage } from './pages/Calendar';
import { EventsPage } from './pages/Events';
import { EventDetailPage } from './pages/EventDetail';
import { ProfilePage } from './pages/Profile';
import { AdminPage } from './pages/Admin';
import { AdminEventEditPage } from './pages/AdminEventEdit';
import { DoorCheckPage } from './pages/DoorCheck';
import { ResetPasswordPage } from './pages/ResetPassword';
import { useAuth } from './state/auth';

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {user ? <Redirect to="/calendar" /> : <AuthPage />}
      </Route>
      <Route path="/auth">
        {user ? <Redirect to="/calendar" /> : <AuthPage />}
      </Route>
      <Route path="/signup">
        {user ? <Redirect to="/calendar" /> : <AuthPage />}
      </Route>
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route>
        {user ? <AuthedApp /> : <Redirect to="/" />}
      </Route>
    </Switch>
  );
}
