import { useEffect } from "react";
import { toast } from "sonner";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const offerUpdate = (worker: ServiceWorker) => {
      toast("Nueva versión de Happy Home lista", {
        description: "Un toque y te la estrenas.",
        duration: Infinity,
        action: {
          label: "Actualizar",
          onClick: () => worker.postMessage("SKIP_WAITING"),
        },
      });
    };

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        void registration.update();
        if (registration.waiting && navigator.serviceWorker.controller) {
          offerUpdate(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              offerUpdate(worker);
            }
          });
        });
      })
      .catch(() => undefined);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}
