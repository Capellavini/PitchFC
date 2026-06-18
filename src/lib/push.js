// Web Push helpers. The VAPID public key is published to the client via
// VITE_VAPID_PUBLIC_KEY; the matching private key lives only in the Edge
// Function's secrets. Everything no-ops gracefully if unsupported/unset.

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const pushConfigured = () => Boolean(VAPID_PUBLIC);

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js"); } catch { return null; }
}

/** Ask permission + subscribe. Returns { endpoint, p256dh, auth } or { error }. */
export async function subscribeToPush() {
  if (!pushSupported()) return { error: "Notificações não suportadas neste dispositivo." };
  if (!VAPID_PUBLIC) return { error: "Notificações ainda não configuradas." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { error: "Permissão recusada." };
  const reg = await registerServiceWorker();
  if (!reg) return { error: "Service worker indisponível." };
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

export const pushPermission = () =>
  typeof Notification !== "undefined" ? Notification.permission : "default";
