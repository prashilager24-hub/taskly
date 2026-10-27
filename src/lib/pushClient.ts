/* Real (PWA) push notification client.
   Subscribes the browser to the Push API, sends the subscription to the
   backend (which stores it and later pushes messages). */

const PUSH_ENDPOINT = "/t2.0/authentificationUtilization/hrFeedback/push";
const SW_PATH = "/push-sw.js";

const getToken = () => {
  try {
    const raw = localStorage.getItem("authUserLD");
    return raw ? (JSON.parse(raw).token || "") : "";
  } catch {
    return "";
  }
};

const getUser = () => {
  try {
    const raw = localStorage.getItem("authUserLD");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const authHeaders = () => ({ Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" });

async function fetchVapidPublicKey() {
  const res = await fetch(`${PUSH_ENDPOINT}/vapid-public-key`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error("Failed to fetch VAPID key");
  const json = await res.json();
  return json?.data;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Push not supported in this browser");
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) throw new Error("No VAPID key from backend");

  const registration = await navigator.serviceWorker.register(SW_PATH);

  if (!("Notification" in window)) {
    throw new Error("Notifications not supported in this browser");
  }

  const perm = Notification.permission;
  if (perm === "denied") {
    throw new Error(
      "Notifications are blocked. Enable them in your browser site settings.",
    );
  }
  if (perm !== "granted") {
    const result = await Notification.requestPermission();
    if (result !== "granted") {
      throw new Error("Notification permission was not granted.");
    }
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const sub = subscription.toJSON();
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error("Incomplete push subscription");
  }

  const res = await fetch(`${PUSH_ENDPOINT}/subscribe`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      team: getUser()?.feedbackresolverteam || "",
    }),
  });

  if (!res.ok) throw new Error("Failed to save subscription");
  localStorage.setItem("pushEnabled", "true");
  return subscription;
}

export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch(`${PUSH_ENDPOINT}/unsubscribe`, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
  } finally {
    localStorage.setItem("pushEnabled", "false");
  }
}

export async function isSubscribed() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
