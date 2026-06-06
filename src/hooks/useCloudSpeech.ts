"use client";

import { useState, useEffect, useRef } from "react";
import { LanguageCode } from "@/types";

interface SpeakOptions {
  voice?: string;
  tone?: "calm" | "empathetic" | "reassuring" | "urgent";
  language?: string;
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

      const res  = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
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

    // Server-side test override isn't accessible here (NEXT_PUBLIC_ vars are inlined at build time)
    const testPhrase = process.env.NEXT_PUBLIC_HUME_TEST_TEXT;
    const rawText    = testPhrase || text;
    const cleanedText = cleanText(rawText);

    if (!cleanedText) {
      console.warn("🔊 [CloudSpeech] speakText — no text to speak, skipping.");
      return;
    }

    const humeApiKey = process.env.NEXT_PUBLIC_HUME_API_KEY;
    if (!humeApiKey) {
      setError("Hume API key not configured (NEXT_PUBLIC_HUME_API_KEY missing).");
      return;
    }

    const voice    = options.voice    || "Priya";
    const tone     = options.tone     || "calm";
    const language = options.language || "en";
    const langLabel = LANG_LABELS[language] || "English";

    const langGuide = language !== "en"
      ? ` The text is in ${langLabel} — pronounce every word naturally as a fluent native ${langLabel} speaker, preserving the language throughout.`
      : "";

    const description = `${VOICE_PERSONAS[voice] ?? VOICE_PERSONAS.Priya}. ${TONE_STYLES[tone] ?? TONE_STYLES.calm}${langGuide}`;

    console.log(`🔊 [CloudSpeech] Hume TTS → voice:${voice} (ID:${HUME_VOICE_ID}) tone:${tone} lang:${language} chars:${cleanedText.length}`);
    if (testPhrase) console.log(`🧪 [CloudSpeech] TEST PHRASE active: "${testPhrase}"`);

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
