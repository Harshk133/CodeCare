"use client";

import React, { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { VoiceSelector } from "@/components/chat/VoiceSelector";
import { Message, Coordinates, LanguageCode } from "@/types";
import { useSpeech } from "@/hooks/useSpeech";
import { useCloudSpeech } from "@/hooks/useCloudSpeech";
import { useHealthStore } from "@/store/useHealthStore";
import { cn } from "@/lib/utils";
import {
  Send,
  Mic,
  MicOff,
  Trash2,
  AlertCircle,
  Loader2,
  Compass,
} from "lucide-react";

function detectTone(text: string): "calm" | "empathetic" | "reassuring" | "urgent" {
  if (text.includes("<emergency>")) return "urgent";
  if (text.includes('"riskLevel":"high"') || text.includes('"riskLevel": "high"')) return "empathetic";
  if (text.includes('"riskLevel":"emergency"') || text.includes('"riskLevel": "emergency"')) return "urgent";
  if (text.includes('"riskLevel":"medium"') || text.includes('"riskLevel": "medium"')) return "reassuring";
  return "calm";
}

export default function ChatClient() {
  const { language, messages, addMessage, clearChat, preferredVoice, setLanguage } = useHealthStore();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState("/api/chat");
  const [gpsCoordinates, setGpsCoordinates] = useState<Coordinates | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [voiceEngine, setVoiceEngine] = useState<"local" | "cloud">("local");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wasListeningRef = useRef(false);

  const localSpeech = useSpeech(language);
  const cloudSpeech = useCloudSpeech();

  const isActiveCloud = voiceEngine === "cloud";
  const speech = isActiveCloud ? cloudSpeech : localSpeech;

  // Detect Capacitor + geolocate on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isCapacitor = window.location.protocol === "file:";
    if (isCapacitor) {
      const fallbackUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://swasthya-ai.vercel.app/api/chat";
      setApiEndpoint(fallbackUrl);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoordinates({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (err) => {
          setGpsError("GPS unavailable. Hospital distances will be estimated.");
          console.warn("⚠️ [Chat] Geolocation failed:", err.message);
        }
      );
    } else {
      setGpsError("Geolocation not supported on this device.");
    }
  }, []);

  // Track microphone activity
  useEffect(() => {
    if (speech.isListening) wasListeningRef.current = true;
  }, [speech.isListening]);

  // Auto-submit on transcription + auto-detect language (cloud only)
  useEffect(() => {
    if (speech.transcript && wasListeningRef.current) {
      wasListeningRef.current = false;
      setInputValue(speech.transcript);

      // Auto-update language from transcription (cloud speech only)
      if (isActiveCloud && cloudSpeech.detectedLanguage && cloudSpeech.detectedLanguage !== language) {
        console.log(`🌐 [Chat] Language auto-detected: ${cloudSpeech.detectedLanguage}`);
        setLanguage(cloudSpeech.detectedLanguage as LanguageCode);
      }

      submitMessage(speech.transcript, true);
    }
  }, [speech.transcript]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    await submitMessage(inputValue, false);
  };

  const submitMessage = async (textToSubmit: string, isVoiceSubmit: boolean) => {
    if (!textToSubmit.trim() || isLoading) return;

    const userText = textToSubmit;
    setInputValue("");
    speech.stopSpeaking();

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: userText,
      timestamp: Date.now(),
      language,
    };

    addMessage(userMessage);
    setIsLoading(true);

    // Filter out system-role error messages before sending to the API
    const activeHistory = [...messages, userMessage]
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const assistantMessageId = `msg-${Date.now()}-assistant`;
    let accumulatedText = "";

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: activeHistory,
          userLocation: gpsCoordinates,
          language,
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;

      addMessage({
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      });

      while (!done && reader) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          accumulatedText += decoder.decode(value, { stream: true });
          useHealthStore.setState((state) => ({
            messages: state.messages.map((m) =>
              m.id === assistantMessageId ? { ...m, content: accumulatedText } : m
            ),
          }));
        }
      }

      // Auto-speak voice responses with detected tone + preferred voice
      if (isVoiceSubmit && isActiveCloud) {
        const tone = detectTone(accumulatedText);
        speech.speakText(accumulatedText, { voice: preferredVoice, tone });
      } else if (isVoiceSubmit) {
        speech.speakText(accumulatedText);
      }
    } catch (err: any) {
      addMessage({
        id: `msg-${Date.now()}-error`,
        role: "system",
        content: `Connection error: ${err.message || "Unable to reach the health assistant."}`,
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)]">
        {gpsError && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-500 font-medium mb-3 border border-amber-500/20">
            <Compass className="h-4 w-4 animate-spin-slow shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Chat bubbles */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 max-w-sm mx-auto">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-primary mb-4 shadow-inner">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h1 className="font-heading text-xl font-bold tracking-tight">Consult SwasthyaAI</h1>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Describe symptoms like &quot;I have sudden high fever and joint pain&quot; or &quot;severe chest pain&quot; to start an assessment.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                onSpeak={(text) => {
                  const tone = detectTone(text);
                  if (isActiveCloud) {
                    speech.speakText(text, { voice: preferredVoice, tone });
                  } else {
                    speech.speakText(text);
                  }
                }}
                isCurrentlySpeaking={speech.isSpeaking}
                onStopSpeaking={speech.stopSpeaking}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom input area */}
        <div className="pt-3 border-t bg-background">
          {/* Engine toggle */}
          <div className="flex items-center justify-between px-1 mb-2 text-xs">
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border">
              <button
                type="button"
                onClick={() => { speech.stopSpeaking(); setVoiceEngine("local"); }}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all font-medium",
                  voiceEngine === "local"
                    ? "bg-card text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Local Voice (Free)
              </button>
              <button
                type="button"
                onClick={() => { speech.stopSpeaking(); setVoiceEngine("cloud"); }}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1",
                  voiceEngine === "cloud"
                    ? "bg-primary text-white shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Cloud Voice (Premium)
              </button>
            </div>
            {voiceEngine === "cloud" ? (
              <div className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 font-medium bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                Whisper + Hume AI
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground font-medium px-2 py-0.5">
                Browser speech API
              </div>
            )}
          </div>

          {/* Voice selector — only shown in cloud mode */}
          {voiceEngine === "cloud" && <VoiceSelector />}

          {/* Language auto-detect badge — shown after detection */}
          {isActiveCloud && cloudSpeech.detectedLanguage && cloudSpeech.detectedLanguage !== "en" && (
            <div className="flex items-center gap-1.5 mt-1.5 px-1 text-[10px] text-teal-600 dark:text-teal-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              <span>Language detected: <strong>{cloudSpeech.detectedLanguage.toUpperCase()}</strong></span>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex gap-2 mt-2">
            <input
              type="text"
              value={isActiveCloud && cloudSpeech.isTranscribing ? "Transcribing via Whisper..." : inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isActiveCloud && cloudSpeech.isTranscribing ? "Processing audio..." : "Describe symptoms or ask health questions..."}
              disabled={isLoading || (isActiveCloud && cloudSpeech.isTranscribing)}
              className="flex-1 rounded-xl border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75"
            />

            {speech.hasSupport && (
              <button
                type="button"
                onClick={speech.isListening ? speech.stopListening : speech.startListening}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
                  speech.isListening
                    ? "bg-red-500 text-white border-red-500 animate-pulse"
                    : "glass hover:bg-muted text-muted-foreground",
                  isActiveCloud && cloudSpeech.isTranscribing && "opacity-50 cursor-not-allowed"
                )}
                disabled={isActiveCloud && cloudSpeech.isTranscribing}
                title={speech.isListening ? "Stop listening" : "Start dictating"}
              >
                {speech.isListening ? (
                  <MicOff className="h-4.5 w-4.5" />
                ) : isActiveCloud && cloudSpeech.isTranscribing ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Mic className="h-4.5 w-4.5" />
                )}
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !inputValue.trim() || (isActiveCloud && cloudSpeech.isTranscribing)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary hover:bg-teal-600 text-white transition-all disabled:opacity-50 disabled:hover:bg-primary shadow-md shadow-primary/10 active:scale-95"
            >
              {isLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => { speech.stopSpeaking(); clearChat(); }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border glass hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                title="Clear conversations"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            )}
          </form>

          {isActiveCloud && cloudSpeech.error && (
            <div className="mt-2 text-xs text-red-500 flex items-center gap-1 px-1">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{cloudSpeech.error}</span>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
