import { Route, Switch, Redirect } from 'wouter';
import { AuthedLayout } from './components/AuthedLayout';
import { AuthPage } from './pages/Auth';
import { CalendarPage } from './pages/Calendar';
import { EventsPage } from './pages/Events';
import { ProfilePage } from './pages/Profile';
import { AdminPage } from './pages/Admin';
import { useAuth } from './state/auth';
import { LandingPage } from './pages/Landing';

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

  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />

      <Route>
        {loading ? (
          <div className="mx-auto max-w-md px-4 py-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              Loading…
            </div>
          </div>
        ) : user ? (
          <AuthedRoutes />
        ) : (
          <Redirect to="/auth" />
        )}
      </Route>
    </Switch>
  );
}
