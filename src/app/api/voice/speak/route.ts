import { NextResponse } from "next/server";
import { experimental_generateSpeech as generateSpeech } from "ai";
import { createHume } from "@ai-sdk/hume";

export const maxDuration = 30;

const HUME_VOICE_ID = "f795ee0c-fc67-44e7-bf99-306c97bb1457";

type ToneName = "calm" | "empathetic" | "reassuring" | "urgent";

const VOICE_PERSONAS: Record<string, string> = {
  Priya:  "a warm, clear Indian female healthcare assistant — friendly, empathetic, and trustworthy",
  Suresh: "a deep, authoritative Indian male doctor — calm, professional, and reassuring",
  Arjun:  "a gentle, calm Indian male counselor — measured, clear, and compassionate",
};

const TONE_STYLES: Record<ToneName, string> = {
  calm:       "Speak in a calm, steady, and professional manner with natural pacing.",
  empathetic: "Speak with warmth and empathy, like a caring counselor — gentle and supportive.",
  reassuring: "Speak in a gentle, reassuring tone — like a trusted family doctor.",
  urgent:     "Speak with urgency and authority — clear, direct, like a medical emergency responder.",
};

const LANG_LABELS: Record<string, string> = {
  en: "English", hi: "Hindi", mr: "Marathi",
  ta: "Tamil",   te: "Telugu", bn: "Bengali", gu: "Gujarati",
};

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<triage>[\s\S]*?<\/triage>/gi, "")
    .replace(/<emergency>[\s\S]*?<\/emergency>/gi, "")
    .replace(/<hospitals>[\s\S]*?<\/hospitals>/gi, "")
    .replace(/<directions>[\s\S]*?<\/directions>/gi, "")
    .replace(/[#*`_]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: Request) {
  console.log("\x1b[36m%s\x1b[0m", "\n📥 [API Speak] Hume TTS (server backup)...");

  try {
    const { text, voice = "Priya", tone = "calm", language = "en" } = await req.json();

    // Apply test override BEFORE the empty-text guard so HUME_TEST_TEXT
    // still triggers even when the LLM returns empty accumulatedText.
    const testOverride = process.env.NEXT_PUBLIC_HUME_TEST_TEXT;
    const rawText = testOverride || text;
    if (testOverride) {
      console.log(`🧪 [API Speak] TEST MODE — "${testOverride}"`);
    }

    const cleanedText = cleanText(rawText);
    if (!cleanedText) {
      return NextResponse.json({ error: "Text is empty after cleaning." }, { status: 400 });
    }

    const humeApiKey = process.env.NEXT_PUBLIC_HUME_API_KEY || process.env.HUME_API_KEY;
    if (!humeApiKey) {
      return NextResponse.json(
        { error: "Voice synthesis not configured. Add HUME_API_KEY to environment." },
        { status: 400 }
      );
    }

    const activeTone  = (["calm", "empathetic", "reassuring", "urgent"].includes(tone) ? tone : "calm") as ToneName;
    const activeVoice = ["Suresh", "Priya", "Arjun"].includes(voice) ? voice : "Priya";
    const langLabel   = LANG_LABELS[language] || "English";

    const langGuide = language !== "en"
      ? ` The text is in ${langLabel} — pronounce every word naturally as a fluent native ${langLabel} speaker.`
      : "";

    const instructions = `${VOICE_PERSONAS[activeVoice]}. ${TONE_STYLES[activeTone]}${langGuide}`;

    console.log(`🔊 [API Speak] Voice ID: ${HUME_VOICE_ID} | ${activeVoice} | ${activeTone} | ${language} | ${cleanedText.length} chars`);

    const hume = createHume({ apiKey: humeApiKey });

    const result = await generateSpeech({
      model: hume.speech(),
      text: cleanedText,
      voice: HUME_VOICE_ID,
      instructions,
    });

    const { uint8Array, mediaType } = result.audio;

    console.log("✅ [API Speak] Hume TTS synthesis successful.");
    return new Response(Buffer.from(uint8Array), {
      headers: { "Content-Type": mediaType || "audio/mpeg" },
    });
  } catch (error: any) {
    console.error("❌ [API Speak] Error:", error);
    return NextResponse.json({ error: `TTS failed: ${error.message || error}` }, { status: 500 });
  }
}
