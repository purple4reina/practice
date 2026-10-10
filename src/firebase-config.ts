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
