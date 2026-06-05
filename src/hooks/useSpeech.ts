"use client";

import { useState, useEffect, useRef } from "react";
import { LanguageCode } from "@/types";

// Map our language codes to speech synthesis BCP-47 locales
const SPEECH_LANG_MAP: Record<LanguageCode, string> = {
  en: "en-US",
  hi: "in-IN", // Hindi (India)
  mr: "mr-IN", // Marathi (India)
  ta: "ta-IN", // Tamil (India)
  te: "te-IN", // Telugu (India)
  bn: "bn-IN", // Bengali (India)
  gu: "gu-IN", // Gujarati (India)
};

export function useSpeech(langCode: LanguageCode = "en") {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = SPEECH_LANG_MAP[langCode] || "en-US";

      rec.onstart = () => {
        setIsListening(true);
        console.log("🎙️ [Speech Recognition] Microphone active.");
      };

      rec.onerror = (event: any) => {
        console.error("❌ [Speech Recognition] Error event:", event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        console.log("🎙️ [Speech Recognition] Microphone deactivated.");
      };

      rec.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        console.log(`🎙️ [Speech Recognition] Result: "${resultText}"`);
        setTranscript(resultText);
      };

      recognitionRef.current = rec;
    }
  }, [langCode]);

  // Update language setting dynamically on active recognition instance
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = SPEECH_LANG_MAP[langCode] || "en-US";
    }
  }, [langCode]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    } else if (!recognitionRef.current) {
      console.warn("⚠️ Speech recognition is not supported in this browser.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // Text-To-Speech (TTS)
  const speakText = (text: string) => {
    if (typeof window === "undefined") return;

    // Stop existing synthesis
    window.speechSynthesis.cancel();

    if (!text) return;

    // Clean text by stripping markdown layout characters and metadata tags before speaking
    const cleanText = text
      .replace(/<triage>[\s\S]*?<\/triage>/gi, "")
      .replace(/<emergency>[\s\S]*?<\/emergency>/gi, "")
      .replace(/[#*`_]/g, "")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = SPEECH_LANG_MAP[langCode] || "en-US";

    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log("🔊 [Speech Synthesis] Starting playback.");
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      console.log("🔊 [Speech Synthesis] Playback finished.");
    };

    utterance.onerror = (e) => {
      console.error("❌ [Speech Synthesis] Error:", e);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSpeaking,
    speakText,
    stopSpeaking,
    hasSupport: typeof window !== "undefined" && !(!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition),
  };
}
