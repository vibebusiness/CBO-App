import { Route, Switch, Redirect } from 'wouter';
import { AuthedLayout } from './components/AuthedLayout';
import { AuthPage } from './pages/Auth';
import { CalendarPage } from './pages/Calendar';
import { EventsPage } from './pages/Events';
import { ProfilePage } from './pages/Profile';
import { AdminPage } from './pages/Admin';
import { useAuth } from './state/auth';

function AuthedRoutes() {
  return (
    <AuthedLayout>
      <Switch>
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/events" component={EventsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/admin" component={AdminPage} />
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
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="text-sm text-white/60">Loading…</div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      <Route path="/auth" component={AuthPage} />

      <Route>
        {user ? <AuthedRoutes /> : <Redirect to="/" />}
      </Route>
    </Switch>
  );
}
