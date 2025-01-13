import * as admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.FIREBASE_PROJECT_ID) {
  throw new Error("Firebase configuration is missing in environment variables");
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const db = admin.firestore();
const journalCollection = db.collection("journal_entries");

export interface JournalEntryData {
  id?: string;
  timestamp: string;
  transcription: string;
  summary?: string;
  audioLength: number;
  metadata?: {
    duration?: string;
    type?: string;
    [key: string]: any;
  };
}

export async function saveJournalEntry(
  data: JournalEntryData
): Promise<string> {
  try {
    const docRef = await journalCollection.add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Journal entry saved with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error saving journal entry:", error);
    throw error;
  }
}

export async function getJournalEntries(): Promise<JournalEntryData[]> {
  try {
    const snapshot = await journalCollection
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as JournalEntryData),
    }));
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    throw error;
  }
}

export async function getJournalEntry(
  id: string
): Promise<JournalEntryData | null> {
  try {
    const doc = await journalCollection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return {
      id: doc.id,
      ...(doc.data() as JournalEntryData),
    };
  } catch (error) {
    console.error("Error fetching journal entry:", error);
    throw error;
  }
}
