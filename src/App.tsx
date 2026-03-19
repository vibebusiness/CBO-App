import { Route, Switch, Redirect } from 'wouter';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/Auth';
import { CalendarPage } from './pages/Calendar';
import { EventsPage } from './pages/Events';
import { ProfilePage } from './pages/Profile';
import { AdminPage } from './pages/Admin';
import { useAuth } from './state/auth';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Switch>
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/admin" component={AdminPage} />
      <Route>
        <Redirect to="/calendar" />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <Layout>
      <AppRoutes />
    </Layout>
  );
}
