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
  entries: Array<{
    timestamp: string;
    transcription: string;
    summary?: string;
    audioLength: number;
    metadata?: {
      duration?: string;
      type?: string;
      [key: string]: any;
    };
  }>;
}

export async function createNewJournalEntry(
  data: Omit<JournalEntryData["entries"][0], "timestamp">
): Promise<string> {
  try {
    const timestamp = new Date().toISOString();
    const docData: JournalEntryData & {
      createdAt: admin.firestore.FieldValue;
    } = {
      timestamp,
      entries: [
        {
          timestamp,
          ...data,
        },
      ],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await journalCollection.add(docData);
    console.log(`New journal entry created with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error creating journal entry:", error);
    throw error;
  }
}

export async function appendToJournalEntry(
  journalId: string,
  data: Omit<JournalEntryData["entries"][0], "timestamp">
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const docRef = journalCollection.doc(journalId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error(`Journal entry with ID ${journalId} not found`);
    }

    await docRef.update({
      entries: admin.firestore.FieldValue.arrayUnion({
        timestamp,
        ...data,
      }),
    });

    console.log(`Appended to journal entry ${journalId}`);
  } catch (error) {
    console.error("Error appending to journal entry:", error);
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
      console.log(`Journal entry with ID ${id} not found`);
      return null;
    }
    const data = doc.data();
    if (!data) {
      console.log(`No data found for journal entry with ID ${id}`);
      return null;
    }
    return {
      id: doc.id,
      ...(data as JournalEntryData),
    };
  } catch (error) {
    console.error("Error fetching journal entry:", error);
    return null;
  }
}

export async function getLatestJournalEntry(): Promise<JournalEntryData | null> {
  try {
    const snapshot = await journalCollection
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log("No journal entries found");
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    if (!data) {
      console.log(`No data found for latest journal entry with ID ${doc.id}`);
      return null;
    }

    // Handle old format (flat structure)
    if (!data.entries) {
      return {
        id: doc.id,
        timestamp: data.timestamp,
        entries: [
          {
            timestamp: data.timestamp,
            transcription: data.transcription,
            summary: data.summary,
            audioLength: data.audioLength,
            metadata: data.metadata,
          },
        ],
      };
    }

    // Handle new format (entries array)
    return {
      id: doc.id,
      ...(data as JournalEntryData),
    };
  } catch (error) {
    console.error("Error fetching latest journal entry:", error);
    return null; // Return null instead of throwing error
  }
}
