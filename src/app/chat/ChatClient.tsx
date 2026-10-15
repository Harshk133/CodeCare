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
import { useTranslation } from "@/hooks/useTranslation";
import { Logo } from "@/components/shared/AppShell";
import {
  ArrowUp, Mic, MicOff, RotateCcw, AlertCircle,
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
  const [hasMounted, setHasMounted]   = useState(false);

  useEffect(() => { setHasMounted(true); }, []);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const wasListeningRef = useRef(false);
  const callModeRef     = useRef(false);
  const langRef         = useRef(language);

  const { requestLocation } = useNativeGeolocation();
  const { t } = useTranslation();

  const localSpeech = useSpeech(language);
  const cloudSpeech = useCloudSpeech();

  const isActiveCloud = voiceEngine === "cloud";
  const speech        = isActiveCloud ? cloudSpeech : localSpeech;

  useEffect(() => { callModeRef.current = callMode; }, [callMode]);
  useEffect(() => { langRef.current = language; }, [language]);

  // Initialise API endpoint + request native/browser geolocation on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Always use getApiUrl so Capacitor (file://) and web both work
    setApiEndpoint(getApiUrl("/api/chat"));

    // Question handed over from the landing page (/chat?q=...). Strip it from the
    // URL first so a refresh or StrictMode re-run doesn't send it twice.
    const handoff = new URLSearchParams(window.location.search).get("q");
    if (handoff) {
      window.history.replaceState(null, "", window.location.pathname);
      submitMessage(handoff, false);
    }

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
      langRef.current = cloudSpeech.detectedLanguage as LanguageCode; // sync ref immediately
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

        // Use langRef.current so we always get the up-to-date language even
        // when setLanguage() hasn't re-rendered yet (stale closure guard).
        const activeLang = langRef.current;

        const fallbackByLang: Record<string, string> = {
          hi: "आपकी बात समझ आई। मैं आपकी सहायता के लिए यहाँ हूँ। कृपया अपने लक्षण बताएं।",
          mr: "तुमची बात समजली. मी तुमच्या मदतीसाठी येथे आहे.",
          ta: "உங்கள் கேள்வி புரிந்தது. உங்களுக்கு உதவ இங்கே இருக்கிறேன்.",
          te: "మీ విషయం అర్థమైంది. మీకు సహాయం చేయడానికి ఇక్కడ ఉన్నాను.",
          bn: "আপনার কথা বুঝলাম। আমি আপনাকে সাহায্য করতে এখানে আছি।",
          gu: "તમારી વાત સમજ આવી. હું તમારી સહાય માટે અહીં છું.",
          en: "I understand. Please describe your symptoms so I can help you.",
        };
        const textToSpeak = speakableText ||
          fallbackByLang[activeLang] ||
          fallbackByLang.en;

        if (isActiveCloud) {
          speech.speakText(textToSpeak, { voice: preferredVoice, tone: detectTone(accumulatedText), language: activeLang, onEnd });
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
        const errMsg = langRef.current === "hi"
          ? "माफ़ करें, कोई समस्या हुई। कृपया दोबारा कोशिश करें।"
          : "Sorry, something went wrong. Please try again.";
        speech.speakText(errMsg, {
          voice: preferredVoice, tone: "calm", language: langRef.current,
          onEnd: callModeRef.current ? autoListen : undefined,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  const isTranscribing = isActiveCloud && cloudSpeech.isTranscribing;
  // Browser-only state (speech API support, persisted history) must not render
  // until after hydration, or the server HTML won't match.
  const hasMic = hasMounted && speech.hasSupport;
  const visibleMessages = hasMounted ? messages : [];
  const lastMessage = visibleMessages[visibleMessages.length - 1];
  const awaitingFirstToken = isLoading && lastMessage?.role === "user";

  return (
    <AppShell variant="app">
      <div className="mx-auto flex h-full max-w-3xl flex-col">

        {/* Status banners */}
        {(gpsError || (isActiveCloud && callMode)) && (
          <div className="space-y-2 px-4 pt-3">
            {gpsError && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />
                {gpsError}
              </p>
            )}

            {isActiveCloud && callMode && (
              <div
                role="status"
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    speech.isListening ? "animate-pulse bg-destructive"
                    : speech.isSpeaking ? "animate-pulse bg-primary"
                    : isLoading || cloudSpeech.isTranscribing ? "animate-pulse bg-caution"
                    : "bg-safe"
                  )}
                />
                <span className="font-medium">{callStatusLabel}</span>
                <button
                  type="button"
                  onClick={toggleCallMode}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-semibold text-destructive-foreground"
                >
                  <PhoneOff className="h-4 w-4" aria-hidden="true" /> End call
                </button>
              </div>
            )}
          </div>
        )}

        {/* Conversation */}
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-4" aria-live="polite">
          {visibleMessages.length === 0 ? (
            <div className="flex min-h-full flex-col justify-center py-10">
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{t("chat_empty_title")}</h1>
              <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-muted-foreground">
                {t("chat_empty_desc")}
              </p>
              <ul className="mt-8 divide-y border-y">
                {["hero_ex_1", "hero_ex_2", "hero_ex_3"].map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => submitMessage(t(key), false)}
                      className="w-full py-3.5 text-left text-[15px] text-foreground transition-colors hover:text-primary"
                    >
                      {t(key)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-8 py-6">
              {visibleMessages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onSpeak={(text) =>
                    isActiveCloud
                      ? speech.speakText(text, { voice: preferredVoice, tone: detectTone(text), language: langRef.current })
                      : speech.speakText(text)
                  }
                  isCurrentlySpeaking={speech.isSpeaking}
                  onStopSpeaking={speech.stopSpeaking}
                />
              ))}
              {awaitingFirstToken && (
                <div className="flex items-center gap-3" aria-label="SwasthyaAI is typing">
                  <Logo className="h-7 w-7 shrink-0" />
                  <div className="flex gap-1.5">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="border-t bg-background px-4 pb-3 pt-3">
          <div className="mb-2.5 flex flex-wrap items-center gap-2 text-sm">
            <div role="radiogroup" aria-label="Voice engine" className="inline-flex rounded-md border bg-card p-0.5">
              {([
                ["local", "Device voice"],
                ["cloud", "Cloud voice"],
              ] as const).map(([engine, label]) => (
                <button
                  key={engine}
                  type="button"
                  role="radio"
                  aria-checked={voiceEngine === engine}
                  onClick={() => {
                    speech.stopSpeaking();
                    if (engine === "local") setCallMode(false);
                    setVoiceEngine(engine);
                  }}
                  className={cn(
                    "rounded px-2.5 py-1 font-medium transition-colors",
                    voiceEngine === engine
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {isActiveCloud && !callMode && (
              <button
                type="button"
                onClick={toggleCallMode}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 font-medium text-foreground transition-colors hover:border-safe/60"
              >
                <Phone className="h-3.5 w-3.5 text-safe" aria-hidden="true" /> Start voice call
              </button>
            )}

            {visibleMessages.length > 0 && (
              <button
                type="button"
                onClick={() => { speech.stopSpeaking(); setCallMode(false); clearChat(); }}
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> New conversation
              </button>
            )}
          </div>

          {isActiveCloud && <VoiceSelector />}

          {isActiveCloud && cloudSpeech.detectedLanguage && cloudSpeech.detectedLanguage !== "en" && (
            <p className="mb-2 text-sm text-muted-foreground">
              Detected language: <span className="font-semibold text-foreground">{cloudSpeech.detectedLanguage.toUpperCase()}</span>
            </p>
          )}

          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-1.5 rounded-xl border-2 bg-card p-1.5 transition-colors focus-within:border-primary"
          >
            <label htmlFor="chat-input" className="sr-only">{t("chat_placeholder")}</label>
            <input
              id="chat-input"
              type="text"
              autoComplete="off"
              value={isTranscribing ? "Transcribing…" : inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={callMode ? "Speak, or type here…" : t("chat_placeholder")}
              disabled={isLoading || isTranscribing}
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground/80 disabled:opacity-60"
            />

            {hasMic && (!callMode || isActiveCloud) && (
              <button
                type="button"
                onClick={speech.isListening ? speech.stopListening : speech.startListening}
                disabled={isTranscribing}
                aria-label={speech.isListening ? "Stop listening" : "Speak your question"}
                aria-pressed={speech.isListening}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50",
                  speech.isListening
                    ? "bg-destructive text-destructive-foreground"
                    : callMode && speech.isSpeaking
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {speech.isListening ? <MicOff className="h-5 w-5" />
                  : isTranscribing ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Mic className="h-5 w-5" />}
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !inputValue.trim() || isTranscribing}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-35"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
            </button>
          </form>

          {isActiveCloud && cloudSpeech.error && (
            <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {cloudSpeech.error}
            </p>
          )}

          <p className="mt-2 text-center text-xs text-muted-foreground">{t("disclaimer_short")}</p>
        </div>
      </div>
    </AppShell>
  );
}
