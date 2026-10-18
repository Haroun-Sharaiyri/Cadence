export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    const doRegister = () => {
      const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
        window.location.hostname === '[::1]' ||
        window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
      );

      if (import.meta.env.PROD || isLocalhost) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[Cadence PWA] ServiceWorker registered with scope:', registration.scope);
          })
          .catch((error) => {
            console.warn('[Cadence PWA] ServiceWorker registration failed:', error);
          });
      }
    };

    if (document.readyState === 'complete') {
      doRegister();
    } else {
      window.addEventListener('load', doRegister, { once: true });
    }
  }
}
