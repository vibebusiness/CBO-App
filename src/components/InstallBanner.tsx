import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'cbo_install_dismissed';

export function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);

    if (isStandalone) return;

    if (isIos) {
      setShowIos(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
    setPrompt(null);
    setShowIos(false);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(DISMISSED_KEY, '1');
    }
    setPrompt(null);
  };

  if (dismissed || (!prompt && !showIos)) return null;

  return (
    <div className="mx-auto mb-3 max-w-md rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <img src="/cbo-logo.png" alt="CBO" className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-xl object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Add CBO to your home screen</p>
          {showIos ? (
            <p className="mt-0.5 text-xs text-slate-500">
              Tap <span className="font-medium">Share</span> then <span className="font-medium">Add to Home Screen</span> for the full app experience.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">
              One tap check-in, offline access, no browser chrome.
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          className="ml-1 flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {!showIos && prompt && (
        <button
          onClick={install}
          className="mt-3 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 active:scale-95"
        >
          Install app
        </button>
      )}
    </div>
  );
}
