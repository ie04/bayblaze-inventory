import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;
const UPDATE_CHECK_COOLDOWN_MS = 8 * 1000;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  let hasReloadedForControllerChange = false;
  let lastUpdateCheckAt = 0;
  let activeRegistration: ServiceWorkerRegistration | undefined;
  let applyWaitingServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

  function reloadOnceWhenNewWorkerControlsPage() {
    if (hasReloadedForControllerChange) {
      return;
    }

    hasReloadedForControllerChange = true;
    window.location.reload();
  }

  async function checkForServiceWorkerUpdate() {
    if (!navigator.onLine || !activeRegistration) {
      return;
    }

    if (activeRegistration.installing) {
      return;
    }

    const now = Date.now();

    if (now - lastUpdateCheckAt < UPDATE_CHECK_COOLDOWN_MS) {
      return;
    }

    lastUpdateCheckAt = now;

    try {
      await activeRegistration.update();

      if (activeRegistration.waiting && applyWaitingServiceWorker) {
        await applyWaitingServiceWorker(true);
      }
    } catch (caught) {
      console.warn("BayBlaze inventory PWA update check failed:", caught);
    }
  }

  navigator.serviceWorker.addEventListener("controllerchange", reloadOnceWhenNewWorkerControlsPage);

  applyWaitingServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      void applyWaitingServiceWorker?.(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return;
      }

      activeRegistration = registration;

      void checkForServiceWorkerUpdate();

      window.setInterval(() => {
        void checkForServiceWorkerUpdate();
      }, UPDATE_CHECK_INTERVAL_MS);

      window.addEventListener("focus", () => {
        void checkForServiceWorkerUpdate();
      });

      window.addEventListener("online", () => {
        void checkForServiceWorkerUpdate();
      });

      window.addEventListener("pageshow", () => {
        void checkForServiceWorkerUpdate();
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          void checkForServiceWorkerUpdate();
        }
      });
    },
    onRegistered(registration) {
      activeRegistration = registration;

      if (registration?.waiting) {
        void applyWaitingServiceWorker?.(true);
      }
    },
  });
}
