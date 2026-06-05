"use client";

import { useState, useEffect, useRef } from "react";
import { LanguageCode } from "@/types";

interface SpeakOptions {
  voice?: string;
  tone?: "calm" | "empathetic" | "reassuring" | "urgent";
}

export function useCloudSpeech() {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageCode | undefined>();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

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

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstart = () => setIsListening(true);

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        const mimeType = mediaRecorder.mimeType || "audio/webm";
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
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || `Server error: ${res.status}`);

      console.log(`✅ [useCloudSpeech] Transcript: "${data.text}" | Language: ${data.language}`);
      setTranscript(data.text);
      if (data.language) setDetectedLanguage(data.language as LanguageCode);
    } catch (err: any) {
      setError(err.message || "Speech-to-text failed.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const speakText = async (text: string, options: SpeakOptions = {}) => {
    if (typeof window === "undefined") return;

    stopSpeaking();
    setError(null);
    setIsSpeaking(true);

    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: options.voice || "Priya",
          tone: options.tone || "calm",
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json") || !res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Synthesis error: ${res.status}`);
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setError("Audio playback failed.");
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err: any) {
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
