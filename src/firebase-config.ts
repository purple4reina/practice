// Firebase web config for cross-device saves sync. These values identify the
// project and are public by design (Firestore security rules enforce access),
// the same way the Datadog client token and Google CLIENT_ID are committed.
//
// Sync is off whenever apiKey is empty.
export const firebaseConfig = {
  apiKey: "AIzaSyBXZL_nHSL8fBmcrVNkoYQGvnb1-eOPX4A",
  authDomain: "practice-a5502.firebaseapp.com",
  projectId: "practice-a5502",
  appId: "1:1024885093535:web:3fdb2c50e8ac74b3fa5eaa",
};

// Sync is a web-build feature for now: the iOS build (--mode ios) has no
// Google sign-in, so it keeps using this device's saves only.
export const syncEnabled = import.meta.env.MODE !== "ios" && firebaseConfig.apiKey !== "";

export const PRODUCTION_HOST = "purple4reina.github.io";

// Which Firestore collection (under users/{uid}) holds the saves. Only the
// production site touches the real "saves"; every other host (localhost, a
// preview of the production build, a LAN address, a future preview domain)
// gets a separate "saves-dev", so testing can never add to, delete from or
// otherwise disturb real saves. Fail-safe by design: production is opt-in by
// exact hostname. The iOS app will need to opt in explicitly when it gets sync.
export function savesCollectionFor(hostname: string): string {
  return hostname === PRODUCTION_HOST ? "saves" : "saves-dev";
}
