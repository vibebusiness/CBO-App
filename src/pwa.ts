import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1_000;
const RELOAD_GUARD_MS = 10_000;
const RELOAD_GUARD_KEY = 'cbo_pwa_reload_at';

function reloadForUpdate() {
  let shouldReload = true;

  try {
    const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    shouldReload = Date.now() - lastReload > RELOAD_GUARD_MS;
    if (shouldReload) sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // Restricted mobile browsers may block sessionStorage; reloading is still safe.
  }

  if (shouldReload) window.location.reload();
}

registerSW({
  immediate: true,
  onNeedReload: reloadForUpdate,
  onRegisteredSW(_serviceWorkerUrl, registration) {
    if (!registration) return;

    window.setInterval(() => {
      void registration.update();
    }, UPDATE_CHECK_INTERVAL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void registration.update();
    });

    void registration.update();
  },
  onRegisterError(error) {
    console.error('CBO offline support could not start:', error);
  },
});
