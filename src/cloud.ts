// Firebase-backed storage for saves. Imported dynamically (see main.ts) so the
// SDK never blocks first paint.
import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { collection, doc, getDocs, initializeFirestore, setDoc } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";
import type { RemoteSavesStore, SaveRecord } from "./saves-merge";
import type { CloudSession } from "./saves-store";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

function isSaveFields(data: Record<string, unknown>): boolean {
  return typeof data.name === "string"
    && typeof data.query === "string"
    && typeof data.createdAt === "number";
}

// users/{uid}/saves/{saveId}; Firestore security rules limit each user to
// their own subtree.
class CloudSavesStore implements RemoteSavesStore {
  constructor(private db: Firestore, private uid: string) {}

  private saves() {
    return collection(this.db, "users", this.uid, "saves");
  }

  async list(): Promise<SaveRecord[]> {
    const snapshot = await getDocs(this.saves());
    return snapshot.docs
      .filter(d => isSaveFields(d.data()))
      .map(d => ({ ...(d.data() as Omit<SaveRecord, "id">), id: d.id }));
  }

  async put(record: SaveRecord): Promise<void> {
    const { id, ...fields } = record;
    await setDoc(doc(this.saves(), id), fields);
  }
}

export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}

// Fires once with the restored session (or null) and again on sign-in/out.
export function onAuthChange(callback: (session: CloudSession | null) => void): () => void {
  return onAuthStateChanged(auth, user => {
    callback(user
      ? { email: user.email || "your account", remote: new CloudSavesStore(db, user.uid) }
      : null);
  });
}
