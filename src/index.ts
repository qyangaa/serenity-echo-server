import express, { Request, Response } from "express";
import cors from "cors";
import {
  transcribeAudio,
  TranscriptionResult,
} from "./services/openai.service";
import {
  createNewJournalEntry,
  appendToJournalEntry,
  getJournalEntries,
  getJournalEntry,
  getLatestJournalEntry,
} from "./services/firebase.service";

// Types
interface JournalEntry {
  audioData: string;
  metadata?: {
    duration?: string;
    type?: string;
    [key: string]: any;
  };
}

interface ApiResponse {
  success?: boolean;
  message: string;
  timestamp?: string;
  metadata?: any;
  format?: string;
  error?: string;
  status?: string;
  transcription?: TranscriptionResult;
  journalId?: string;
}

const app = express();

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: ["http://localhost:3001", "http://127.0.0.1:3001"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json({ limit: "50mb" })); // Increased limit for audio data

// Helper function to validate WebM data
function isValidWebMData(data: string): boolean {
  try {
    // Check if the data starts with the WebM header magic numbers
    const buffer = Buffer.from(data, "base64");

    // WebM files start with 0x1A 0x45 0xDF 0xA3 (EBML header)
    return (
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    );
  } catch (error) {
    console.error("Error validating WebM data:", error);
    return false;
  }
}

// Basic route
app.get("/", (_req: Request, res: Response<ApiResponse>) => {
  res.json({ message: "Welcome to the Serenity Echo Server!" });
});

// Echo route - returns whatever is sent
app.post("/echo", (req: Request, res: Response) => {
  console.log(`[${new Date().toISOString()}] Received echo request`);
  console.log("Request Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Request Body:", JSON.stringify(req.body, null, 2));

  try {
    res.json(req.body);
    console.log(
      `[${new Date().toISOString()}] Echo response sent successfully`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error in echo endpoint:`,
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Internal Server Error",
      message: errorMessage,
    });
  }
});

// Journal entry route handler
const handleJournalEntry: express.RequestHandler<
  {},
  ApiResponse,
  JournalEntry
> = async (req, res) => {
  console.log(`[${new Date().toISOString()}] Received journal entry request`);

  try {
    const { audioData, metadata } = req.body;

    // Validate request body
    if (!audioData) {
      console.error(
        `[${new Date().toISOString()}] Missing audio data in request`
      );
      res.status(400).json({
        error: "Missing audio data",
        message: "Audio data is required",
      });
      return;
    }

    // Validate WebM format
    if (!isValidWebMData(audioData)) {
      console.error(
        `[${new Date().toISOString()}] Invalid audio format - WebM required`
      );
      res.status(400).json({
        error: "Invalid audio format",
        message: "Audio data must be in WebM format (base64 encoded)",
      });
      return;
    }

    // Log the receipt of data (excluding the actual audio data for clarity)
    console.log("Received metadata:", JSON.stringify(metadata, null, 2));
    console.log("Audio data length:", audioData.length);
    console.log("Audio format validation: Passed WebM check");

    // Convert base64 to buffer for transcription
    const audioBuffer = Buffer.from(audioData, "base64");

    // Transcribe the audio
    console.log("Starting audio transcription...");
    const transcriptionResult = await transcribeAudio(audioBuffer);
    console.log("Transcription completed:", transcriptionResult.text);

    // Save to Firestore
    const timestamp = new Date().toISOString();
    const journalId = await createNewJournalEntry({
      transcription: transcriptionResult.text,
      summary: transcriptionResult.summary,
      audioLength: audioBuffer.length,
      metadata,
    });

    res.json({
      success: true,
      message: "Journal entry received, transcribed, and saved successfully",
      timestamp,
      metadata,
      format: "webm",
      transcription: transcriptionResult,
      journalId,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error processing journal entry:`,
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Internal Server Error",
      message: errorMessage,
    });
  }
};

// Get all journal entries
app.get("/journal", async (_req: Request, res: Response) => {
  try {
    const entries = await getJournalEntries();
    res.json(entries);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Internal Server Error",
      message: errorMessage,
    });
  }
});

// Get latest journal entry
app.get("/journal/latest", async (_req: Request, res: Response) => {
  try {
    const entry = await getLatestJournalEntry();
    if (!entry) {
      res.status(404).json({
        error: "Not Found",
        message: "No journal entries found",
      });
      return;
    }
    res.json(entry);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Internal Server Error",
      message: errorMessage,
    });
  }
});

// Get latest journal entry or create new one
app.get("/journal/latest-or-new", async (_req: Request, res: Response) => {
  try {
    console.log("Attempting to get latest journal entry");
    // Try to get the latest entry
    let entry = await getLatestJournalEntry();

    // If no entry exists, create a new empty one
    if (!entry) {
      console.log("No existing journal entry found, creating new one");
      try {
        const journalId = await createNewJournalEntry({
          transcription: "",
          audioLength: 0,
          metadata: {
            type: "journal",
          },
        });

        console.log(`Created new journal entry with ID: ${journalId}`);
        entry = await getJournalEntry(journalId);

        if (!entry) {
          console.error("Failed to retrieve newly created journal entry");
          throw new Error("Failed to create and retrieve new journal entry");
        }

        console.log("Successfully retrieved new journal entry");
      } catch (createError) {
        console.error("Error creating new journal entry:", createError);
        throw createError;
      }
    } else {
      console.log("Found existing latest journal entry");
    }

    res.json(entry);
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error in latest-or-new endpoint:`,
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Internal Server Error",
      message: errorMessage,
    });
  }
});

// Get specific journal entry
app.get("/journal/:id", async (req: Request, res: Response) => {
  try {
    const entry = await getJournalEntry(req.params.id);
    if (!entry) {
      res.status(404).json({
        error: "Not Found",
        message: "Journal entry not found",
      });
      return;
    }
    res.json(entry);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Internal Server Error",
      message: errorMessage,
    });
  }
});

// Register journal route
app.post("/journal", handleJournalEntry);

// Health check route
app.get("/health", (_req: Request, res: Response<ApiResponse>) => {
  res.json({ status: "healthy", message: "Server is healthy" });
});

// Create new journal entry
app.post(
  "/journal/new",
  async (
    req: Request<{}, ApiResponse, JournalEntry>,
    res: Response<ApiResponse>
  ) => {
    console.log(
      `[${new Date().toISOString()}] Received new journal entry request`
    );

    try {
      const { audioData, metadata } = req.body;

      // Validate request body
      if (!audioData) {
        console.error(
          `[${new Date().toISOString()}] Missing audio data in request`
        );
        res.status(400).json({
          error: "Missing audio data",
          message: "Audio data is required",
        });
        return;
      }

      // Validate WebM format
      if (!isValidWebMData(audioData)) {
        console.error(
          `[${new Date().toISOString()}] Invalid audio format - WebM required`
        );
        res.status(400).json({
          error: "Invalid audio format",
          message: "Audio data must be in WebM format (base64 encoded)",
        });
        return;
      }

      // Log the receipt of data
      console.log("Received metadata:", JSON.stringify(metadata, null, 2));
      console.log("Audio data length:", audioData.length);
      console.log("Audio format validation: Passed WebM check");

      // Convert base64 to buffer for transcription
      const audioBuffer = Buffer.from(audioData, "base64");

      // Transcribe the audio
      console.log("Starting audio transcription...");
      const transcriptionResult = await transcribeAudio(audioBuffer);
      console.log("Transcription completed:", transcriptionResult.text);

      // Save to Firestore
      const journalId = await createNewJournalEntry({
        transcription: transcriptionResult.text,
        summary: transcriptionResult.summary,
        audioLength: audioBuffer.length,
        metadata,
      });

      res.json({
        success: true,
        message: "New journal entry created successfully",
        timestamp: new Date().toISOString(),
        metadata,
        format: "webm",
        transcription: transcriptionResult,
        journalId,
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error creating journal entry:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Internal Server Error",
        message: errorMessage,
      });
    }
  }
);

// Append to existing journal entry
app.post(
  "/journal/:id/append",
  async (
    req: Request<{ id: string }, ApiResponse, JournalEntry>,
    res: Response<ApiResponse>
  ) => {
    console.log(
      `[${new Date().toISOString()}] Received append journal entry request`
    );

    try {
      const { audioData, metadata } = req.body;
      const { id } = req.params;

      // Validate request body
      if (!audioData) {
        console.error(
          `[${new Date().toISOString()}] Missing audio data in request`
        );
        res.status(400).json({
          error: "Missing audio data",
          message: "Audio data is required",
        });
        return;
      }

      // Validate WebM format
      if (!isValidWebMData(audioData)) {
        console.error(
          `[${new Date().toISOString()}] Invalid audio format - WebM required`
        );
        res.status(400).json({
          error: "Invalid audio format",
          message: "Audio data must be in WebM format (base64 encoded)",
        });
        return;
      }

      // Log the receipt of data
      console.log("Received metadata:", JSON.stringify(metadata, null, 2));
      console.log("Audio data length:", audioData.length);
      console.log("Audio format validation: Passed WebM check");

      // Convert base64 to buffer for transcription
      const audioBuffer = Buffer.from(audioData, "base64");

      // Transcribe the audio
      console.log("Starting audio transcription...");
      const transcriptionResult = await transcribeAudio(audioBuffer);
      console.log("Transcription completed:", transcriptionResult.text);

      // Append to existing journal entry
      await appendToJournalEntry(id, {
        transcription: transcriptionResult.text,
        summary: transcriptionResult.summary,
        audioLength: audioBuffer.length,
        metadata,
      });

      res.json({
        success: true,
        message: "Successfully appended to journal entry",
        timestamp: new Date().toISOString(),
        metadata,
        format: "webm",
        transcription: transcriptionResult,
        journalId: id,
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Error appending to journal entry:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Internal Server Error",
        message: errorMessage,
      });
    }
  }
);

const PORT: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
