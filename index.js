const express = require("express");
const cors = require("cors");
const app = express();

// CORS configuration
const corsOptions = {
  origin: ["http://localhost:3001", "http://127.0.0.1:3001"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json({ limit: "50mb" })); // Increased limit for audio data

// Helper function to validate WebM data
function isValidWebMData(data) {
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
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Serenity Echo Server!" });
});

// Echo route - returns whatever is sent
app.post("/echo", (req, res) => {
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
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

// Journal entry route
app.post("/journal", (req, res) => {
  console.log(`[${new Date().toISOString()}] Received journal entry request`);

  try {
    const { audioData, metadata } = req.body;

    // Validate request body
    if (!audioData) {
      console.error(
        `[${new Date().toISOString()}] Missing audio data in request`
      );
      return res.status(400).json({ error: "Missing audio data" });
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

    res.json({
      success: true,
      message: "Journal entry received successfully",
      timestamp: new Date().toISOString(),
      metadata,
      format: "webm",
    });

    console.log(
      `[${new Date().toISOString()}] Journal entry processed successfully`
    );
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error processing journal entry:`,
      error
    );
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
});

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
