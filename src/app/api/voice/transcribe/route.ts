import { NextResponse } from "next/server";
import { LanguageCode } from "@/types";

export const maxDuration = 30;

const SUPPORTED_LANGUAGES: LanguageCode[] = ["en", "hi", "mr", "ta", "te", "bn", "gu"];

function mapToLanguageCode(isoCode: string | undefined): LanguageCode | undefined {
  if (!isoCode) return undefined;
  const code = isoCode.toLowerCase().split("-")[0] as LanguageCode;
  return SUPPORTED_LANGUAGES.includes(code) ? code : undefined;
}

export async function POST(req: Request) {
  console.log("\x1b[36m%s\x1b[0m", "\n📥 [API Transcribe] Received Speech-To-Text request (gpt-4o-mini-transcribe)...");

  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided in request." }, { status: 400 });
    }

    console.log(`🎙️ [API Transcribe] Audio details -> Size: ${file.size} bytes, Type: ${file.type}`);

    const apiKey = process.env.OPENAI_API_KEY;
    const apiBaseUrl = process.env.OPENAI_API_BASE_URL || "https://openrouter.ai/api/v1";
    const whisperModel = process.env.OPENAI_WHISPER_MODEL || "openai/gpt-4o-mini-transcribe";
    const transcribeUrl = `${apiBaseUrl}/audio/transcriptions`;

    console.log(`🎙️ [API Transcribe] Using model: ${whisperModel} | Base: ${apiBaseUrl}`);

    if (!apiKey) {
      console.warn("⚠️ [API Transcribe] OPENAI_API_KEY missing. Returning simulated transcript.");
      return NextResponse.json({
        text: "I have sudden high fever and joint pain. Can you recommend specialized clinics near me for dengue?",
        language: "en",
        simulated: true,
      });
    }

    const whisperFormData = new FormData();
    const fileExtension = file.type.split("/")[1]?.replace("mpeg", "mp3") || "webm";
    const audioFile = new File([file], `audio.${fileExtension}`, { type: file.type });
    whisperFormData.append("file", audioFile);
    whisperFormData.append("model", whisperModel);
    whisperFormData.append("response_format", "json");

    console.log(`🎙️ [API Transcribe] Dispatching to: ${transcribeUrl}...`);
    const startTime = Date.now();

    const res = await fetch(transcribeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperFormData,
    });

    const duration = Date.now() - startTime;
    console.log(`🎙️ [API Transcribe] Response status: ${res.status} (${duration}ms)`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ [API Transcribe] Error:`, errorText);
      return NextResponse.json(
        { error: `Transcription API failed (${res.status}): ${errorText}` },
        { status: res.status }
      );
    }

    const result = await res.json();
    const detectedLang = mapToLanguageCode(result.language);

    console.log(`✅ [API Transcribe] Success: "${result.text}" | Language: ${result.language} → mapped: ${detectedLang}`);
    return NextResponse.json({ text: result.text, language: detectedLang });
  } catch (error: any) {
    console.error("❌ [API Transcribe] Critical error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message || error}` },
      { status: 500 }
    );
  }
}
