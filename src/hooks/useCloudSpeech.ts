"use client";

import { useState, useEffect, useRef } from "react";
import { LanguageCode } from "@/types";
import { getApiUrl } from "@/lib/getApiUrl";

interface SpeakOptions {
  voice?: string;
  tone?: "calm" | "empathetic" | "reassuring" | "urgent";
  language?: string;
  onEnd?: () => void;
}

// ─── Voice / tone / language descriptors sent to Hume as the "description" field ─

const VOICE_PERSONAS: Record<string, string> = {
  Priya:  "a warm, clear Indian female healthcare assistant — friendly, empathetic, and trustworthy",
  Suresh: "a deep, authoritative Indian male doctor — calm, professional, and reassuring",
  Arjun:  "a gentle, calm Indian male counselor — measured, clear, and compassionate",
};

const TONE_STYLES: Record<string, string> = {
  calm:       "Speak in a calm, steady, and professional manner with natural pacing.",
  empathetic: "Speak with warmth and empathy, like a caring counselor — gentle and supportive.",
  reassuring: "Speak in a gentle, reassuring tone — like a trusted family doctor.",
  urgent:     "Speak with urgency and authority — clear, direct, like a medical emergency responder.",
};

const LANG_LABELS: Record<string, string> = {
  en: "English", hi: "Hindi", mr: "Marathi",
  ta: "Tamil",   te: "Telugu", bn: "Bengali", gu: "Gujarati",
};

// Build explicit language-aware description for Hume.
// For Hindi we must be very forceful — without this Hume drifts into Japanese or Urdu
// because short Hindi syllables ("hai", "kya", "hu") resemble Japanese phonetics.
function buildHumeDescription(voice: string, tone: string, language: string): string {
  const persona   = VOICE_PERSONAS[voice]  ?? VOICE_PERSONAS.Priya;
  const toneStyle = TONE_STYLES[tone]      ?? TONE_STYLES.calm;
  const langLabel = LANG_LABELS[language]  ?? "English";

  if (language === "hi" || language === "mr") {
    return (
      `LANGUAGE INSTRUCTION (MANDATORY): You MUST speak EXCLUSIVELY in Hindi (हिन्दी). ` +
      `This text is written in Hindi language. Use authentic Hindustani pronunciation as spoken in India. ` +
      `ABSOLUTELY DO NOT speak in Japanese, English, Urdu, Arabic, Chinese, or any other language. ` +
      `Every single word must be pronounced in Hindi. ` +
      `Voice character: ${persona}. Delivery: ${toneStyle}`
    );
  }

  if (language !== "en") {
    return (
      `LANGUAGE INSTRUCTION: Speak ONLY in ${langLabel}. ` +
      `This text is in ${langLabel}. Use native ${langLabel} pronunciation. ` +
      `Do NOT switch to English or any other language. ` +
      `Voice character: ${persona}. Delivery: ${toneStyle}`
    );
  }

  return `${persona}. ${toneStyle}`;
}

// The Hume voice ID to use for all speech synthesis.
const HUME_VOICE_ID = "f795ee0c-fc67-44e7-bf99-306c97bb1457";
const HUME_API_URL  = "https://api.hume.ai/v0/tts/file";

// Strips XML metadata tags and markdown decoration before sending to TTS.
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

// For Hindi/Marathi TTS: remove any Arabic/Urdu script characters that the LLM
// accidentally emits, then normalise punctuation to Devanagari conventions.
// This is the last safety net before the text reaches Hume.
function sanitizeDevanagari(text: string): string {
  // Strip entire Arabic/Urdu Unicode block (U+0600–U+06FF) and extended Arabic (U+0750–U+077F, U+FB50–U+FDFF, U+FE70–U+FEFF)
  let out = text
    .replace(/[؀-ۿ]/g, "")
    .replace(/[ݐ-ݿ]/g, "")
    .replace(/[ﭐ-﷿]/g, "")
    .replace(/[ﹰ-﻿]/g, "");

  // Convert ASCII period at sentence boundary → Devanagari danda "।"
  // Match period followed by space/newline/end-of-string (avoid decimals like 1.5)
  out = out.replace(/\.(\s|$)/g, "।$1");

  // Convert ASCII exclamation → keep as-is (understandable in Hindi TTS)
  // Convert ASCII question mark → keep as-is

  // Collapse multiple dandas / spaces
  out = out.replace(/।{2,}/g, "।").replace(/\s{2,}/g, " ").trim();

  // Ensure the text ends with a danda if it ends with Devanagari and no punctuation
  if (out && /[ऀ-ॿ]$/.test(out)) out += "।";

  return out;
}

export function useCloudSpeech() {
  const [isListening, setIsListening]       = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript]         = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageCode | undefined>();
  const [isSpeaking, setIsSpeaking]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const audioStreamRef   = useRef<MediaStream | null>(null);
  const audioRef         = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ─── Recording ────────────────────────────────────────────────────────────────

  const startListening = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices) {
      setError("Audio recording is not supported in this browser.");
      return;
    }

    setError(null);
    setTranscript("");
    setDetectedLanguage(undefined);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      let options: MediaRecorderOptions = { mimeType: "audio/webm" };
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        options = MediaRecorder.isTypeSupported("audio/ogg") ? { mimeType: "audio/ogg" } : { mimeType: "" };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstart  = () => setIsListening(true);
      mediaRecorder.onstop   = async () => {
        setIsListening(false);
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        const mimeType  = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
    } catch (err: any) {
      setError(err.message || "Microphone access denied.");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) mediaRecorderRef.current.stop();
  };

  // ─── STT via OpenRouter ────────────────────────────────────────────────────────

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      const res  = await fetch(getApiUrl("/api/voice/transcribe"), { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || `Server error: ${res.status}`);

      console.log(`✅ [CloudSpeech] Transcript: "${data.text}" | Language: ${data.language}`);
      setTranscript(data.text);
      if (data.language) setDetectedLanguage(data.language as LanguageCode);
    } catch (err: any) {
      setError(err.message || "Speech-to-text failed.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // ─── TTS via Hume REST API (client-side, no API route) ────────────────────────

  const speakText = async (text: string, options: SpeakOptions = {}) => {
    if (typeof window === "undefined") return;

    stopSpeaking();
    setError(null);

    // Destructure options first so language is available for sanitization below
    const voice    = options.voice    || "Priya";
    const tone     = options.tone     || "calm";
    const language = options.language || "en";

    const testPhrase = process.env.NEXT_PUBLIC_HUME_TEST_TEXT;
    const rawText    = testPhrase || text;
    let   cleanedText = cleanText(rawText);

    // For Hindi/Marathi: strip any Urdu/Arabic characters the LLM emitted and
    // normalise punctuation to Devanagari danda "।" before sending to Hume.
    if (language === "hi" || language === "mr") {
      cleanedText = sanitizeDevanagari(cleanedText);
    }

    if (!cleanedText) {
      console.warn("🔊 [CloudSpeech] speakText — no text to speak, skipping.");
      return;
    }

    const humeApiKey = process.env.NEXT_PUBLIC_HUME_API_KEY;
    if (!humeApiKey) {
      setError("Hume API key not configured (NEXT_PUBLIC_HUME_API_KEY missing).");
      return;
    }

    const description = buildHumeDescription(voice, tone, language);

    console.log(`🔊 [CloudSpeech] Hume TTS → voice:${voice} tone:${tone} lang:${language} chars:${cleanedText.length}`);
    if (testPhrase) console.log(`🧪 [CloudSpeech] TEST PHRASE active: "${testPhrase}"`);
    console.log(`🔊 [CloudSpeech] Hume description: "${description.slice(0, 120)}…"`);

    setIsSpeaking(true);

    try {
      const res = await fetch(HUME_API_URL, {
        method: "POST",
        headers: {
          "X-Hume-Api-Key": humeApiKey,
          "Content-Type":   "application/json",
        },
        body: JSON.stringify({
          utterances: [
            {
              text:        cleanedText,
              voice:       { id: HUME_VOICE_ID },
              description,
            },
          ],
        }),
      });

      console.log(`🔊 [CloudSpeech] Hume response: ${res.status} content-type: ${res.headers.get("content-type")}`);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Hume TTS failed (${res.status}): ${errText}`);
      }

      const audioBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "audio/mpeg";
      const audioBlob   = new Blob([audioBuffer], { type: contentType });
      const audioUrl    = URL.createObjectURL(audioBlob);

      console.log(`✅ [CloudSpeech] Hume audio received: ${audioBuffer.byteLength} bytes`);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay  = () => { console.log("▶️ [CloudSpeech] playback started"); setIsSpeaking(true); };
      audio.onended = () => {
        console.log("⏹️ [CloudSpeech] playback ended");
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        options.onEnd?.();
      };
      audio.onerror = (e) => {
        console.error("❌ [CloudSpeech] playback error:", e);
        setIsSpeaking(false);
        setError("Audio playback failed.");
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err: any) {
      console.error("❌ [CloudSpeech] Hume TTS error:", err.message);
      setError(err.message || "Text-to-speech failed.");
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsSpeaking(false);
    }
  };

  return {
    isListening,
    isTranscribing,
    transcript,
    detectedLanguage,
    isSpeaking,
    error,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
    hasSupport: typeof window !== "undefined" && !!window.MediaRecorder && !!navigator.mediaDevices,
  };
}
