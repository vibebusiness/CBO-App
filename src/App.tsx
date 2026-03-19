import { Route, Switch, Redirect } from 'wouter';
import { AuthedLayout } from './components/AuthedLayout';
import { AuthPage } from './pages/Auth';
import { SetupPage } from './pages/Setup';
import { CalendarPage } from './pages/Calendar';
import { EventsPage } from './pages/Events';
import { EventDetailPage } from './pages/EventDetail';
import { ProfilePage } from './pages/Profile';
import { AdminPage } from './pages/Admin';
import { useAuth } from './state/auth';

function AuthedApp() {
  const { user } = useAuth();

  if (!user?.full_name) {
    return <SetupPage />;
  }

  return (
    <AuthedLayout>
      <Switch>
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/events/:id" component={EventDetailPage} />
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
      <Route>
        {user ? <AuthedApp /> : <Redirect to="/" />}
      </Route>
    </Switch>
  );
}
