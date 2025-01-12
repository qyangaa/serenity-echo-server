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
  summary?: string;
}

export async function summarizeText(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a concise summarizer that creates brief, clear bullet points in markdown format. Extract only the key points and insights. Keep it to 2-4 bullet points maximum.",
        },
        {
          role: "user",
          content: `Summarize this journal entry in bullet points:\n${text}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content || "- No summary generated";
  } catch (error) {
    console.error("Error generating summary:", error);
    throw error;
  }
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

    // Generate summary if transcription is successful
    let summary: string | undefined;
    if (transcription.text) {
      try {
        summary = await summarizeText(transcription.text);
      } catch (error) {
        console.error("Error generating summary:", error);
      }
    }

    return {
      text: transcription.text,
      duration: audioBuffer.length,
      language: "en",
      summary,
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
