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
import { getApiUrl } from "@/lib/getApiUrl";
import { useNativeGeolocation } from "@/hooks/useNativeBridge";
import {
  Send, Mic, MicOff, Trash2, AlertCircle,
  Loader2, Compass, Phone, PhoneOff,
} from "lucide-react";

// Set NEXT_PUBLIC_VOICE_TEST_MODE=true to skip LLM and test Hume TTS with a fixed phrase.
const VOICE_TEST_MODE   = process.env.NEXT_PUBLIC_VOICE_TEST_MODE === "true";
const VOICE_TEST_PHRASE = "hi mai swasthya ai hu mai apki kya madat kr sakta hu";

function detectTone(text: string): "calm" | "empathetic" | "reassuring" | "urgent" {
  if (text.includes("<emergency>")) return "urgent";
  if (text.includes('"riskLevel":"high"') || text.includes('"riskLevel": "high"')) return "empathetic";
  if (text.includes('"riskLevel":"emergency"') || text.includes('"riskLevel": "emergency"')) return "urgent";
  if (text.includes('"riskLevel":"medium"') || text.includes('"riskLevel": "medium"')) return "reassuring";
  return "calm";
}

export default function ChatClient() {
  const { language, messages, addMessage, clearChat, preferredVoice, setLanguage } = useHealthStore();
  const [inputValue, setInputValue]   = useState("");
  const [isLoading, setIsLoading]     = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState(() => getApiUrl("/api/chat"));
  const [gpsCoordinates, setGpsCoordinates] = useState<Coordinates | null>(null);
  const [gpsError, setGpsError]       = useState<string | null>(null);
  const [voiceEngine, setVoiceEngine] = useState<"local" | "cloud">("local");
  const [callMode, setCallMode]       = useState(false);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const wasListeningRef = useRef(false);
  const callModeRef     = useRef(false);

  const { requestLocation } = useNativeGeolocation();

  const localSpeech = useSpeech(language);
  const cloudSpeech = useCloudSpeech();

  const isActiveCloud = voiceEngine === "cloud";
  const speech        = isActiveCloud ? cloudSpeech : localSpeech;

  useEffect(() => { callModeRef.current = callMode; }, [callMode]);

  // Initialise API endpoint + request native/browser geolocation on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Always use getApiUrl so Capacitor (file://) and web both work
    setApiEndpoint(getApiUrl("/api/chat"));

    requestLocation().then((coords) => {
      if (coords) {
        setGpsCoordinates(coords);
      } else {
        setGpsError("GPS unavailable. Hospital distances will be estimated.");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track when mic was active so we can act on transcript
  useEffect(() => {
    if (speech.isListening) wasListeningRef.current = true;
  }, [speech.isListening]);

  // Auto-restart listening after Hume finishes — used in call mode
  const autoListen = () => {
    setTimeout(() => {
      if (callModeRef.current && !isLoading) speech.startListening();
    }, 700);
  };

  // Handle new transcript: run test mode OR full LLM pipeline
  useEffect(() => {
    if (!speech.transcript || !wasListeningRef.current) return;
    wasListeningRef.current = false;
    setInputValue(speech.transcript);

    if (VOICE_TEST_MODE && isActiveCloud) {
      console.log("🧪 [Chat] VOICE_TEST_MODE — speaking fixed phrase via Hume");
      speech.speakText(VOICE_TEST_PHRASE, {
        voice:    preferredVoice,
        tone:     "calm",
        language: "hi",
        onEnd:    callModeRef.current ? autoListen : undefined,
      });
      return;
    }

    if (isActiveCloud && cloudSpeech.detectedLanguage && cloudSpeech.detectedLanguage !== language) {
      console.log(`🌐 [Chat] Language auto-detected: ${cloudSpeech.detectedLanguage}`);
      setLanguage(cloudSpeech.detectedLanguage as LanguageCode);
    }

    submitMessage(speech.transcript, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.transcript]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ─── Phone call mode ─────────────────────────────────────────────────────────

  const toggleCallMode = () => {
    if (callMode) {
      speech.stopSpeaking();
      speech.stopListening();
      setCallMode(false);
    } else {
      setCallMode(true);
      // Brief delay so state flushes before we start recording
      setTimeout(() => speech.startListening(), 400);
    }
  };

  // Determine what the call status bar should say
  const callStatusLabel = (() => {
    if (speech.isListening) return "Listening… speak now";
    if (speech.isSpeaking)  return "SwasthyaAI is speaking…";
    if (isLoading || (isActiveCloud && cloudSpeech.isTranscribing)) return "Thinking…";
    return "Call active — tap mic or wait";
  })();

  // ─── Chat submission ──────────────────────────────────────────────────────────

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    await submitMessage(inputValue, false);
  };

  const submitMessage = async (textToSubmit: string, isVoiceSubmit: boolean) => {
    if (!textToSubmit.trim() || isLoading) return;

    setInputValue("");
    speech.stopSpeaking();

    const userMessage: Message = {
      id:        `msg-${Date.now()}-user`,
      role:      "user",
      content:   textToSubmit,
      timestamp: Date.now(),
      language,
    };

    addMessage(userMessage);
    setIsLoading(true);

    const activeHistory = [...messages, userMessage]
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const assistantMessageId = `msg-${Date.now()}-assistant`;
    let accumulatedText = "";

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: activeHistory, userLocation: gpsCoordinates, language }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const reader  = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;

      addMessage({ id: assistantMessageId, role: "assistant", content: "", timestamp: Date.now() });

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

      // Speak the response and, in call mode, auto-restart listening when done.
      // Fallback text fires when the LLM returns only structured XML (no prose) so
      // Hume still speaks something meaningful in the user's language.
      if (isVoiceSubmit) {
        const onEnd = callModeRef.current && isActiveCloud ? autoListen : undefined;

        // Strip XML metadata — what remains is the speakable prose
        const speakableText = accumulatedText
          .replace(/<triage>[\s\S]*?<\/triage>/gi, "")
          .replace(/<emergency>[\s\S]*?<\/emergency>/gi, "")
          .replace(/<hospitals>[\s\S]*?<\/hospitals>/gi, "")
          .replace(/<directions>[\s\S]*?<\/directions>/gi, "")
          .trim();

        // Hindi fallback when the LLM response is empty or purely structural
        const fallbackByLang: Record<string, string> = {
          hi: "आपकी बात समझ आई। मैं आपकी सहायता के लिए यहाँ हूँ। कृपया अपने लक्षण बताएं।",
          en: "I understand. Please describe your symptoms so I can help you.",
        };
        const textToSpeak = speakableText ||
          fallbackByLang[language] ||
          fallbackByLang.en;

        if (isActiveCloud) {
          speech.speakText(textToSpeak, { voice: preferredVoice, tone: detectTone(accumulatedText), language, onEnd });
        } else {
          speech.speakText(textToSpeak, { onEnd });
        }
      }
    } catch (err: any) {
      addMessage({
        id:        `msg-${Date.now()}-error`,
        role:      "system",
        content:   `Connection error: ${err.message || "Unable to reach the health assistant."}`,
        timestamp: Date.now(),
      });
      if (isVoiceSubmit && isActiveCloud) {
        const errMsg = language === "hi"
          ? "माफ़ करें, कोई समस्या हुई। कृपया दोबारा कोशिश करें।"
          : "Sorry, something went wrong. Please try again.";
        speech.speakText(errMsg, {
          voice: preferredVoice, tone: "calm", language,
          onEnd: callModeRef.current ? autoListen : undefined,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)]">

        {/* GPS error banner */}
        {gpsError && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-500 font-medium mb-3 border border-amber-500/20">
            <Compass className="h-4 w-4 shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Call mode status bar */}
        {isActiveCloud && callMode && (
          <div className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium mb-2 border transition-all",
            speech.isListening
              ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
              : speech.isSpeaking
              ? "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400"
              : "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
          )}>
            <span className={cn(
              "h-2 w-2 rounded-full shrink-0",
              speech.isListening ? "bg-red-500 animate-pulse"
              : speech.isSpeaking ? "bg-teal-500 animate-pulse"
              : isLoading || cloudSpeech.isTranscribing ? "bg-yellow-500 animate-pulse"
              : "bg-green-500"
            )} />
            <Phone className="h-3 w-3 shrink-0" />
            <span>{callStatusLabel}</span>
            <button
              type="button"
              onClick={toggleCallMode}
              className="ml-auto flex items-center gap-1 text-red-500 hover:text-red-600 font-semibold"
            >
              <PhoneOff className="h-3.5 w-3.5" /> End
            </button>
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
                Describe symptoms like &quot;I have sudden high fever and joint pain&quot; or switch to{" "}
                <strong>Cloud Voice</strong> and tap <strong>Start Call</strong> for a hands-free voice conversation.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                onSpeak={(text) =>
                  isActiveCloud
                    ? speech.speakText(text, { voice: preferredVoice, tone: detectTone(text), language })
                    : speech.speakText(text)
                }
                isCurrentlySpeaking={speech.isSpeaking}
                onStopSpeaking={speech.stopSpeaking}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom input area */}
        <div className="pt-3 border-t bg-background">

          {/* Engine toggle + call button */}
          <div className="flex items-center justify-between px-1 mb-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border">
                <button
                  type="button"
                  onClick={() => { speech.stopSpeaking(); setCallMode(false); setVoiceEngine("local"); }}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-all font-medium",
                    voiceEngine === "local"
                      ? "bg-card text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Local (Free)
                </button>
                <button
                  type="button"
                  onClick={() => { speech.stopSpeaking(); setVoiceEngine("cloud"); }}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-all font-medium",
                    voiceEngine === "cloud"
                      ? "bg-primary text-white shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Cloud (Hume AI)
                </button>
              </div>

              {/* Start / end call button — cloud only */}
              {isActiveCloud && (
                <button
                  type="button"
                  onClick={toggleCallMode}
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all",
                    callMode
                      ? "bg-red-500 text-white border-red-500 shadow-sm"
                      : "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20"
                  )}
                >
                  {callMode
                    ? <><PhoneOff className="h-3 w-3" /> End Call</>
                    : <><Phone   className="h-3 w-3" /> Start Call</>}
                </button>
              )}
            </div>

            {voiceEngine === "cloud" ? (
              <div className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400 font-medium bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                Whisper + Hume AI
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground px-1">Browser API</span>
            )}
          </div>

          {/* Voice selector */}
          {isActiveCloud && <VoiceSelector />}

          {/* Language detection badge */}
          {isActiveCloud && cloudSpeech.detectedLanguage && cloudSpeech.detectedLanguage !== "en" && (
            <div className="flex items-center gap-1.5 mt-1.5 px-1 text-[10px] text-teal-600 dark:text-teal-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              Language detected: <strong>{cloudSpeech.detectedLanguage.toUpperCase()}</strong>
            </div>
          )}

          {/* Text input row */}
          <form onSubmit={handleSendMessage} className="flex gap-2 mt-2">
            <input
              type="text"
              value={isActiveCloud && cloudSpeech.isTranscribing ? "Transcribing…" : inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                callMode
                  ? "Call active — speak or type…"
                  : isActiveCloud && cloudSpeech.isTranscribing
                  ? "Processing audio…"
                  : "Describe symptoms or ask health questions…"
              }
              disabled={isLoading || (isActiveCloud && cloudSpeech.isTranscribing)}
              className="flex-1 rounded-xl border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75"
            />

            {/* Mic button — push-to-talk (hidden in call mode to avoid confusion) */}
            {speech.hasSupport && !callMode && (
              <button
                type="button"
                onClick={speech.isListening ? speech.stopListening : speech.startListening}
                disabled={isActiveCloud && cloudSpeech.isTranscribing}
                title={speech.isListening ? "Stop listening" : "Start dictating"}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
                  speech.isListening
                    ? "bg-red-500 text-white border-red-500 animate-pulse"
                    : "glass hover:bg-muted text-muted-foreground",
                  isActiveCloud && cloudSpeech.isTranscribing && "opacity-50 cursor-not-allowed"
                )}
              >
                {speech.isListening ? <MicOff className="h-4.5 w-4.5" />
                  : isActiveCloud && cloudSpeech.isTranscribing ? <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  : <Mic className="h-4.5 w-4.5" />}
              </button>
            )}

            {/* In call mode: show a large mic indicator instead of the button */}
            {speech.hasSupport && callMode && isActiveCloud && (
              <button
                type="button"
                onClick={speech.isListening ? speech.stopListening : speech.startListening}
                disabled={cloudSpeech.isTranscribing}
                title="Tap to stop/start mic"
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all",
                  speech.isListening
                    ? "bg-red-500 text-white border-red-500 animate-pulse scale-110"
                    : speech.isSpeaking
                    ? "bg-teal-500/20 text-teal-500 border-teal-500/30"
                    : cloudSpeech.isTranscribing
                    ? "opacity-50 cursor-not-allowed"
                    : "glass text-muted-foreground hover:bg-muted"
                )}
              >
                {speech.isListening ? <MicOff className="h-4.5 w-4.5" />
                  : cloudSpeech.isTranscribing ? <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  : <Mic className="h-4.5 w-4.5" />}
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !inputValue.trim() || (isActiveCloud && cloudSpeech.isTranscribing)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary hover:bg-teal-600 text-white transition-all disabled:opacity-50 shadow-md shadow-primary/10 active:scale-95"
            >
              {isLoading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => { speech.stopSpeaking(); setCallMode(false); clearChat(); }}
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
