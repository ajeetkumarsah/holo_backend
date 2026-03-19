import * as admin from "firebase-admin";

let initialized = false;

/**
 * Lazily initialise Firebase Admin SDK.
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON env var (stringified JSON)
 * OR individual FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY vars.
 */
function ensureInitialized() {
  if (initialized) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Fallback: individual env vars
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        "FCM: Firebase credentials not configured. Push notifications disabled."
      );
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  initialized = true;
}

export interface FcmPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a single FCM push notification.
 * Returns true on success, false on failure (non-throwing).
 */
export async function sendPushNotification(
  payload: FcmPayload
): Promise<boolean> {
  try {
    ensureInitialized();
    if (!initialized) return false;

    await admin.messaging().send({
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data ?? {},
      android: {
        priority: "high",
        notification: {
          channelId: "chat_messages",
          priority: "high",
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: "default",
            badge: 1,
          },
        },
      },
    });

    return true;
  } catch (err: any) {
    // Token invalid / app uninstalled — clean up silently
    if (
      err?.code === "messaging/registration-token-not-registered" ||
      err?.code === "messaging/invalid-registration-token"
    ) {
      console.warn("FCM: Stale token, should be removed:", payload.token);
    } else {
      console.error("FCM: sendPushNotification error:", err?.message ?? err);
    }
    return false;
  }
}
