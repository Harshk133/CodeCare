import { NextResponse } from "next/server";
import { LanguageCode } from "@/types";

export const maxDuration = 30;

const SUPPORTED_LANGUAGES: LanguageCode[] = ["en", "hi", "mr", "ta", "te", "bn", "gu"];

function mapToLanguageCode(isoCode: string | undefined): LanguageCode | undefined {
  if (!isoCode) return undefined;
  const code = isoCode.toLowerCase().split("-")[0] as LanguageCode;
  return SUPPORTED_LANGUAGES.includes(code) ? code : undefined;
}

// Fallback: detect language from Unicode script when the API returns no language field.
// gpt-4o-mini-transcribe via OpenRouter often omits the language field.
function detectLanguageFromScript(text: string): LanguageCode | undefined {
  if (!text || text.length < 5) return undefined;
  let urdu = 0, devanagari = 0, tamil = 0, telugu = 0, bengali = 0, gujarati = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0600 && cp <= 0x06ff) urdu++;          // Arabic/Urdu script
    else if (cp >= 0x0900 && cp <= 0x097f) devanagari++; // Devanagari (Hindi/Marathi)
    else if (cp >= 0x0b80 && cp <= 0x0bff) tamil++;
    else if (cp >= 0x0c00 && cp <= 0x0c7f) telugu++;
    else if (cp >= 0x0980 && cp <= 0x09ff) bengali++;
    else if (cp >= 0x0a80 && cp <= 0x0aff) gujarati++;
  }

  const total = text.length;
  const pct = (n: number) => n / total;
  if (pct(urdu) > 0.15) return "hi";       // Urdu script → treat as Hindi (closest supported)
  if (pct(devanagari) > 0.15) return "hi"; // Devanagari → Hindi
  if (pct(tamil) > 0.15) return "ta";
  if (pct(telugu) > 0.15) return "te";
  if (pct(bengali) > 0.15) return "bn";
  if (pct(gujarati) > 0.15) return "gu";
  return undefined;
}

// Map browser MIME type → OpenRouter audio format string
function mimeToFormat(mimeType: string): string {
  const base = mimeType.split(";")[0].toLowerCase().trim();
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
  };
  return map[base] || "webm";
}

export async function POST(req: Request) {
  console.log("\x1b[36m%s\x1b[0m", "\n📥 [API Transcribe] Received Speech-To-Text request...");

  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided in request." }, { status: 400 });
    }

    const format = mimeToFormat(file.type);
    console.log(`🎙️ [API Transcribe] Audio -> Size: ${file.size} bytes, Type: ${file.type}, Format: ${format}`);

    const apiBaseUrl = process.env.OPENAI_API_BASE_URL || "https://openrouter.ai/api/v1";
    const whisperModel = process.env.OPENAI_WHISPER_MODEL || "openai/gpt-4o-mini-transcribe";
    const isOpenRouter = apiBaseUrl.includes("openrouter.ai");

    // OpenRouter uses OPENROUTER_API_KEY; direct OpenAI uses OPENAI_API_KEY
    const apiKey = isOpenRouter
      ? (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)
      : process.env.OPENAI_API_KEY;

    console.log(`🎙️ [API Transcribe] Model: ${whisperModel} | Route: ${isOpenRouter ? "OpenRouter (JSON)" : "OpenAI (multipart)"}`);

    if (!apiKey) {
      console.warn("⚠️ [API Transcribe] No API key — returning simulated transcript.");
      return NextResponse.json({
        text: "I have sudden high fever and joint pain. Can you recommend specialized clinics near me for dengue?",
        language: "en",
        simulated: true,
      });
    }

    const transcribeUrl = `${apiBaseUrl}/audio/transcriptions`;
    const startTime = Date.now();

    let res: Response;

    if (isOpenRouter) {
      // OpenRouter expects JSON body with base64-encoded audio in input_audio field
      // (NOT multipart/form-data — see https://openrouter.ai/docs#audio)
      const audioBuffer = await file.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString("base64");

      console.log(`🎙️ [API Transcribe] Sending JSON/base64 (${format}) to OpenRouter...`);

      res = await fetch(transcribeUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://swasthya-ai.vercel.app",
          "X-OpenRouter-Title": "SwasthyaAI",
        },
        body: JSON.stringify({
          model: whisperModel,
          input_audio: {
            data: base64Audio,
            format,
          },
        }),
      });
    } else {
      // Direct OpenAI: use standard multipart/form-data (whisper-1 style)
      const whisperFormData = new FormData();
      const audioFile = new File([file], `audio.${format}`, { type: file.type });
      whisperFormData.append("file", audioFile);
      whisperFormData.append("model", whisperModel);
      whisperFormData.append("response_format", "verbose_json");

      console.log(`🎙️ [API Transcribe] Sending multipart to OpenAI...`);

      res = await fetch(transcribeUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: whisperFormData,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`🎙️ [API Transcribe] Response: ${res.status} (${duration}ms)`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ [API Transcribe] Error:`, errorText);
      return NextResponse.json(
        { error: `Transcription failed (${res.status}): ${errorText}` },
        { status: res.status }
      );
    }

    const result = await res.json();
    // gpt-4o-mini-transcribe via OpenRouter often omits the language field.
    // Use Unicode-script detection as fallback for Indian languages.
    const detectedLang =
      mapToLanguageCode(result.language) ?? detectLanguageFromScript(result.text ?? "");

    console.log(
      `✅ [API Transcribe] "${result.text?.slice(0, 60)}..." | lang: ${result.language ?? "none"} → ${detectedLang ?? "en"}`
    );
    return NextResponse.json({ text: result.text, language: detectedLang });
  } catch (error: any) {
    console.error("❌ [API Transcribe] Critical error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message || error}` },
      { status: 500 }
    );
  }
}
