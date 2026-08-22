import { useState } from "react";

import type { PersonId } from "@/lib/cleaning";
import {
  getPushConfig,
  subscribeToReminders,
  unsubscribeFromReminders,
} from "@/server/cleaning.functions";

export function usePushReminders(person: PersonId | null) {
  const [busy, setBusy] = useState(false);

  const setEnabled = async (enabled: boolean): Promise<boolean> => {
    if (
      !person ||
      typeof Notification === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    )
      return false;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!enabled) {
        if (existing) {
          await unsubscribeFromReminders({ data: { endpoint: existing.endpoint } });
          await existing.unsubscribe();
        }
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;
      const config = await getPushConfig();
      if (!config.enabled || !config.publicKey) return true;
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        }));
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.["p256dh"] || !json.keys["auth"]) return false;
      await subscribeToReminders({
        data: {
          personId: person,
          subscription: {
            endpoint: json.endpoint,
            expirationTime: json.expirationTime ?? null,
            keys: { p256dh: json.keys["p256dh"], auth: json.keys["auth"] },
          },
        },
      });
      return true;
    } finally {
      setBusy(false);
    }
  };

  return { setEnabled, busy };
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}
