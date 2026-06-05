import { NextResponse } from "next/server";

export const maxDuration = 30;

type ToneName = "calm" | "empathetic" | "reassuring" | "urgent";

const TONE_DESCRIPTIONS: Record<ToneName, string> = {
  calm: "A calm, clear, and professional healthcare assistant voice with natural pacing.",
  empathetic: "A warm, empathetic, and compassionate counselor voice with gentle, caring delivery.",
  reassuring: "A reassuring and gentle doctor voice, steady and professional with clear pronunciation.",
  urgent: "An urgent, direct, and authoritative medical emergency responder voice.",
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
  console.log("\x1b[36m%s\x1b[0m", "\n📥 [API Speak] Received TTS synthesis request (Hume Octave 2)...");

  try {
    const { text, voice = "Priya", tone = "calm" } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided in request body." }, { status: 400 });
    }

    const cleanedText = cleanText(text);
    if (!cleanedText) {
      return NextResponse.json({ error: "Text is empty after cleaning." }, { status: 400 });
    }

    const activeTone: ToneName = (["calm", "empathetic", "reassuring", "urgent"].includes(tone) ? tone : "calm") as ToneName;
    const activeVoice = ["Suresh", "Priya", "Arjun"].includes(voice) ? voice : "Priya";
    const description = TONE_DESCRIPTIONS[activeTone];

    const humeApiKey = process.env.HUME_API_KEY;

    console.log(`🔊 [API Speak] Voice: ${activeVoice} | Tone: ${activeTone} | Text length: ${cleanedText.length} chars`);
    console.log(`🔊 [API Speak] Hume Key present: ${humeApiKey ? "YES" : "NO"}`);

    if (humeApiKey) {
      console.log("🔊 [API Speak] Dispatching to Hume AI Octave 2...");
      const startTime = Date.now();

      const humeRes = await fetch("https://api.hume.ai/v0/tts/file", {
        method: "POST",
        headers: {
          "X-Hume-Api-Key": humeApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          utterances: [
            {
              text: cleanedText,
              description,
              voice: {
                name: activeVoice,
                provider: "HUME_AI",
              },
            },
          ],
          format: { type: "mp3" },
          version: "2",
        }),
      });

      const duration = Date.now() - startTime;
      console.log(`🔊 [API Speak] Hume response: ${humeRes.status} (${duration}ms)`);

      if (humeRes.ok) {
        const audioBuffer = await humeRes.arrayBuffer();
        console.log("✅ [API Speak] Hume TTS synthesis successful.");
        return new Response(audioBuffer, {
          headers: { "Content-Type": "audio/mpeg" },
        });
      }

      const errorText = await humeRes.text();
      console.error(`❌ [API Speak] Hume TTS Error (${humeRes.status}):`, errorText);
      return NextResponse.json(
        { error: `Hume TTS failed (${humeRes.status}): ${errorText}` },
        { status: humeRes.status }
      );
    }

    console.warn("⚠️ [API Speak] HUME_API_KEY not configured.");
    return NextResponse.json(
      { error: "Voice synthesis not configured. Add HUME_API_KEY to environment." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("❌ [API Speak] Critical error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message || error}` },
      { status: 500 }
    );
  }
}
