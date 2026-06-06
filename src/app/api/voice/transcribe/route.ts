import { NextResponse } from "next/server";
import { LanguageCode } from "@/types";

export const maxDuration = 30;

const SUPPORTED_LANGUAGES: LanguageCode[] = ["en", "hi", "mr", "ta", "te", "bn", "gu"];

function mapToLanguageCode(isoCode: string | undefined): LanguageCode | undefined {
  if (!isoCode) return undefined;
  const code = isoCode.toLowerCase().split("-")[0] as LanguageCode;
  return SUPPORTED_LANGUAGES.includes(code) ? code : undefined;
}

// Fallback: detect language from Unicode script when API returns no language field.
function detectLanguageFromScript(text: string): LanguageCode | undefined {
  if (!text || text.length < 3) return undefined;
  let devanagari = 0, urdu = 0, tamil = 0, telugu = 0, bengali = 0, gujarati = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0900 && cp <= 0x097f) devanagari++;
    else if (cp >= 0x0600 && cp <= 0x06ff) urdu++;
    else if (cp >= 0x0b80 && cp <= 0x0bff) tamil++;
    else if (cp >= 0x0c00 && cp <= 0x0c7f) telugu++;
    else if (cp >= 0x0980 && cp <= 0x09ff) bengali++;
    else if (cp >= 0x0a80 && cp <= 0x0aff) gujarati++;
  }

  const total = text.length;
  const pct   = (n: number) => n / total;
  if (pct(devanagari) > 0.15) return "hi";
  if (pct(urdu)       > 0.15) return "hi";
  if (pct(tamil)      > 0.15) return "ta";
  if (pct(telugu)     > 0.15) return "te";
  if (pct(bengali)    > 0.15) return "bn";
  if (pct(gujarati)   > 0.15) return "gu";
  return undefined;
}

// Transliterate common Devanagari + Arabic characters to Latin equivalents
// so Hindi/Urdu speech never shows up as non-Latin on screen.
function transliterateToLatin(text: string): string {
  // Devanagari vowels & consonants → romanised approximations
  const devanagariMap: Record<string, string> = {
    "अ":"a","आ":"aa","इ":"i","ई":"ee","उ":"u","ऊ":"oo","ए":"e","ऐ":"ai","ओ":"o","औ":"au",
    "क":"k","ख":"kh","ग":"g","घ":"gh","च":"ch","छ":"chh","ज":"j","झ":"jh",
    "ट":"t","ठ":"th","ड":"d","ढ":"dh","त":"t","थ":"th","द":"d","ध":"dh",
    "न":"n","प":"p","फ":"ph","ब":"b","भ":"bh","म":"m","य":"y","र":"r",
    "ल":"l","व":"v","श":"sh","ष":"sh","स":"s","ह":"h","ं":"n","ः":"h",
    "ा":"a","ि":"i","ी":"i","ु":"u","ू":"u","े":"e","ै":"ai","ो":"o","ौ":"au",
    "्":"","ृ":"ri","ँ":"n",
  };

  // Arabic / Urdu → romanised approximations
  const urduMap: Record<string, string> = {
    "ا":"a","ب":"b","پ":"p","ت":"t","ٹ":"t","ث":"s","ج":"j","چ":"ch","ح":"h","خ":"kh",
    "د":"d","ڈ":"d","ذ":"z","ر":"r","ڑ":"r","ز":"z","ژ":"zh","س":"s","ش":"sh","ص":"s",
    "ض":"z","ط":"t","ظ":"z","ع":"a","غ":"gh","ف":"f","ق":"q","ک":"k","گ":"g","ل":"l",
    "م":"m","ن":"n","ں":"n","و":"o","ہ":"h","ھ":"h","ی":"i","ے":"e","ئ":"y","ء":"a",
    "آ":"aa","اے":"ai","اور":"aur","کیا":"kya","کے":"ke","کی":"ki","کا":"ka","نے":"ne",
    "ِ":"i","َ":"a","ُ":"u","ّ":"","ْ":"",
  };

  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0900 && cp <= 0x097f && devanagariMap[ch]) {
      out += devanagariMap[ch];
    } else if ((cp >= 0x0600 && cp <= 0x06ff) && urduMap[ch]) {
      out += urduMap[ch];
    } else {
      out += ch;
    }
  }
  // Clean up: collapse spaces, strip trailing/leading whitespace
  return out.replace(/\s+/g, " ").trim();
}

// Returns true if the text contains significant non-Latin script characters
function hasNonLatinScript(text: string): boolean {
  let nonLatin = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    // Devanagari, Arabic/Urdu, Tamil, Telugu, Bengali, Gujarati
    if ((cp >= 0x0600 && cp <= 0x06ff) ||
        (cp >= 0x0900 && cp <= 0x097f) ||
        (cp >= 0x0b80 && cp <= 0x0bff) ||
        (cp >= 0x0c00 && cp <= 0x0c7f) ||
        (cp >= 0x0980 && cp <= 0x09ff) ||
        (cp >= 0x0a80 && cp <= 0x0aff)) {
      nonLatin++;
    }
  }
  return nonLatin / text.length > 0.1;
}

function mimeToFormat(mimeType: string): string {
  const base = mimeType.split(";")[0].toLowerCase().trim();
  const map: Record<string, string> = {
    "audio/webm": "webm", "audio/ogg": "ogg",  "audio/mp4": "mp4",
    "audio/mpeg": "mp3",  "audio/mp3": "mp3",   "audio/wav": "wav",
    "audio/wave": "wav",  "audio/flac": "flac",  "audio/x-flac": "flac",
  };
  return map[base] || "webm";
}

export async function POST(req: Request) {
  console.log("\x1b[36m%s\x1b[0m", "\n📥 [API Transcribe] Speech-To-Text request...");

  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
    }

    const format = mimeToFormat(file.type);
    console.log(`🎙️ [API Transcribe] Size: ${file.size} bytes | Type: ${file.type} | Format: ${format}`);

    const apiBaseUrl    = process.env.OPENAI_API_BASE_URL || "https://openrouter.ai/api/v1";
    const whisperModel  = process.env.OPENAI_WHISPER_MODEL || "openai/gpt-4o-mini-transcribe";
    const isOpenRouter  = apiBaseUrl.includes("openrouter.ai");

    const apiKey = isOpenRouter
      ? (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)
      : process.env.OPENAI_API_KEY;

    console.log(`🎙️ [API Transcribe] Model: ${whisperModel} | Route: ${isOpenRouter ? "OpenRouter (JSON)" : "OpenAI (multipart)"}`);

    if (!apiKey) {
      return NextResponse.json({
        text: "Mujhe bukhar aur jodon mein dard hai. Kya aap dengue ke baare mein bata sakte hain?",
        language: "hi",
        simulated: true,
      });
    }

    const transcribeUrl = `${apiBaseUrl}/audio/transcriptions`;
    const startTime     = Date.now();

    let res: Response;

    if (isOpenRouter) {
      const audioBuffer  = await file.arrayBuffer();
      const base64Audio  = Buffer.from(audioBuffer).toString("base64");

      // Prompt: force Latin/Roman script so Hindi/Urdu never appears as non-Latin characters.
      // Also biases the model toward Hindi spoken in India for better accuracy.
      const transcribePrompt =
        "Transcribe spoken Indian Hindi or English in Roman/English alphabet only. " +
        "Write every Hindi or Urdu word phonetically using English letters " +
        "(e.g. 'mujhe bukhar hai' not 'मुझे बुखार है'). " +
        "Do not use Devanagari, Arabic, Urdu, or any non-Latin script at all. " +
        "Medical and health-related terms are common in this context.";

      console.log("🎙️ [API Transcribe] Sending JSON/base64 to OpenRouter (language:hi + Latin-script prompt)...");

      res = await fetch(transcribeUrl, {
        method: "POST",
        headers: {
          Authorization:   `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
          "HTTP-Referer":  "https://swasthya-ai.vercel.app",
          "X-Title":       "SwasthyaAI",
        },
        body: JSON.stringify({
          model:       whisperModel,
          input_audio: { data: base64Audio, format },
          // language hint improves Hindi accuracy; prompt forces Latin/Roman output
          language:    "hi",
          prompt:      transcribePrompt,
        }),
      });
    } else {
      const whisperFormData = new FormData();
      const audioFile = new File([file], `audio.${format}`, { type: file.type });
      whisperFormData.append("file", audioFile);
      whisperFormData.append("model", whisperModel);
      whisperFormData.append("response_format", "verbose_json");
      whisperFormData.append(
        "prompt",
        "Transcribe in Roman/Latin English script. Hindi words phonetically in English letters only."
      );

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
      console.error("❌ [API Transcribe] Error:", errorText);
      return NextResponse.json(
        { error: `Transcription failed (${res.status}): ${errorText}` },
        { status: res.status }
      );
    }

    const result = await res.json();
    let transcribedText: string = result.text ?? "";

    // If the model still returned non-Latin script despite the prompt, transliterate it.
    if (transcribedText && hasNonLatinScript(transcribedText)) {
      console.warn("⚠️ [API Transcribe] Non-Latin script detected — transliterating to Roman...");
      transcribedText = transliterateToLatin(transcribedText);
    }

    const detectedLang =
      mapToLanguageCode(result.language) ??
      detectLanguageFromScript(result.text ?? "") ??
      (transcribedText ? "hi" : undefined); // default to Hindi when no language returned for Indian speech

    console.log(
      `✅ [API Transcribe] "${transcribedText?.slice(0, 80)}..." | raw-lang: ${result.language ?? "none"} → ${detectedLang ?? "en"}`
    );

    return NextResponse.json({ text: transcribedText, language: detectedLang });
  } catch (error: any) {
    console.error("❌ [API Transcribe] Critical error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message || error}` },
      { status: 500 }
    );
  }
}
