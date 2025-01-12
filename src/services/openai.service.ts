import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set in environment variables");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
  error?: string;
}

export async function transcribeAudio(
  audioBuffer: Buffer
): Promise<TranscriptionResult> {
  try {
    // Create a blob from the audio buffer
    const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });

    // Create a File object from the blob
    const file = new File([audioBlob], "audio.webm", { type: "audio/webm" });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "en", // optional, will auto-detect if not specified
      response_format: "json",
    });

    return {
      text: transcription.text,
      duration: audioBuffer.length, // approximate duration based on buffer size
      language: "en",
    };
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return {
      text: "",
      error:
        error instanceof Error
          ? error.message
          : "Unknown error occurred during transcription",
    };
  }
}
