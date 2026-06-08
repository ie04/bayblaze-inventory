import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  let hasRefreshedForControllerChange = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasRefreshedForControllerChange) {
      return;
    }

    hasRefreshedForControllerChange = true;
    window.location.reload();
  });

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateServiceWorker(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return;
      }

      window.setInterval(() => {
        if (!navigator.onLine || registration.installing) {
          return;
        }

        void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });
}
