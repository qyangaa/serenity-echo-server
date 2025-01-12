import express, { Request, Response, RequestHandler } from "express";
import cors from "cors";

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
const handleJournalEntry: RequestHandler = (
  req: Request<{}, {}, JournalEntry>,
  res: Response<ApiResponse>
) => {
  console.log(`[${new Date().toISOString()}] Received journal entry request`);

  try {
    const { audioData, metadata } = req.body;

    // Validate request body
    if (!audioData) {
      console.error(
        `[${new Date().toISOString()}] Missing audio data in request`
      );
      return res.status(400).json({
        error: "Missing audio data",
        message: "Audio data is required",
      });
    }

    // Validate WebM format
    if (!isValidWebMData(audioData)) {
      console.error(
        `[${new Date().toISOString()}] Invalid audio format - WebM required`
      );
      return res.status(400).json({
        error: "Invalid audio format",
        message: "Audio data must be in WebM format (base64 encoded)",
      });
    }

    // Log the receipt of data (excluding the actual audio data for clarity)
    console.log("Received metadata:", JSON.stringify(metadata, null, 2));
    console.log("Audio data length:", audioData.length);
    console.log("Audio format validation: Passed WebM check");

    // Here you would typically:
    // 1. Save the audio file
    // 2. Process the audio
    // 3. Store metadata
    // For now, we'll just acknowledge receipt

    return res.json({
      success: true,
      message: "Journal entry received successfully",
      timestamp: new Date().toISOString(),
      metadata,
      format: "webm",
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error processing journal entry:`,
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      error: "Internal Server Error",
      message: errorMessage,
    });
  }
};

// Register journal route
app.post("/journal", handleJournalEntry);

// Health check route
app.get("/health", (_req: Request, res: Response<ApiResponse>) => {
  res.json({ status: "healthy", message: "Server is healthy" });
});

const PORT: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
