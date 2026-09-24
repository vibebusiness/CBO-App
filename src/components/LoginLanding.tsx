import React from 'react';
import { Redirect } from 'wouter';
import { getEvents } from '../lib/api';
import { selectArrivalEvent } from '../lib/events';

/** Only mounted at the app's login/signup entry routes, never while browsing. */
export function LoginLanding() {
  const [destination, setDestination] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    // Do not hold up entry if the optional event lookup stalls.
    const timer = window.setTimeout(() => {
      active = false;
      setDestination('/events');
    }, 5000);
    getEvents()
      .then(events => {
        if (!active) return;
        const event = selectArrivalEvent(events);
        setDestination(event ? `/events/${event.id}?checkin=1` : '/events');
      })
      .catch(error => {
        console.warn('Could not choose an arrival event; opening the event list.', error);
        if (active) setDestination('/events');
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  if (destination) return <Redirect to={destination} />;
  return <div role="status" className="p-8 text-center text-slate-600">Opening your events…</div>;
}