"use client";

import React, { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { Message, Coordinates } from "@/types";
import { useSpeech } from "@/hooks/useSpeech";
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

export default function ChatClient() {
  const { language, messages, addMessage, clearChat } = useHealthStore();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState("/api/chat");
  const [gpsCoordinates, setGpsCoordinates] = useState<Coordinates | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Speech Assistant Hook
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSpeaking,
    speakText,
    stopSpeaking,
    hasSupport: voiceSupported,
  } = useSpeech(language);

  // 1. Detect Capacitor environment and geolocate user on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect file:// local protocol typical of mobile apps
    const isCapacitor = window.location.protocol === "file:";
    if (isCapacitor) {
      const fallbackUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "https://swasthya-ai.vercel.app/api/chat";
      setApiEndpoint(fallbackUrl);
      console.log(`📱 [Chat Page] Capacitor mobile environment detected. Routing API absolutely to: ${fallbackUrl}`);
    } else {
      console.log("💻 [Chat Page] Web browser environment detected. Routing API relatively to /api/chat");
    }

    // Geolocation API lookup
    if (navigator.geolocation) {
      console.log("🌐 [Chat Page] Requesting device GPS coordinates...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setGpsCoordinates(coords);
          console.log(`✅ [Chat Page] GPS coordinates retrieved: [Lat: ${coords.latitude}, Lng: ${coords.longitude}]`);
        },
        (error) => {
          console.warn("⚠️ [Chat Page] Geolocation permission denied/failed:", error.message);
          setGpsError("GPS coordinates unavailable. Hospital distances will be simulated.");
        }
      );
    } else {
      setGpsError("Geolocation is not supported by this device.");
    }
  }, []);

  // 2. Synchronize speech recognition transcripts into input state
  useEffect(() => {
    if (transcript) {
      setInputValue(transcript);
    }
  }, [transcript]);

  // 3. Keep chat view scrolled to bottom on new messages or streaming
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 4. Send query to Next.js API Route (Handles streaming & tools)
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    setInputValue("");
    stopSpeaking(); // Shut down TTS playback if user speaks a new query

    // Format new user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: userText,
      timestamp: Date.now(),
      language,
    };

    console.log(`\n💬 [Chat UI] Sending query to API: "${userText}"`);
    addMessage(userMessage);
    setIsLoading(true);

    // Prepare message history payload
    const activeHistory = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Placeholder message for assistant stream
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    let accumulatedText = "";

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: activeHistory,
          userLocation: gpsCoordinates,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned error code: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;

      // Create initial assistant placeholder
      const initialAssistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      addMessage(initialAssistantMessage);

      // Loop to read stream chunks
      console.log("⚡ [Chat UI] Connected to API stream. Reading chunks...");
      while (!done && reader) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;

          // Update store message list by directly rewriting the latest message
          useHealthStore.setState((state) => {
            const updated = state.messages.map((m) =>
              m.id === assistantMessageId ? { ...m, content: accumulatedText } : m
            );
            return { messages: updated };
          });
        }
      }
      console.log("✅ [Chat UI] Stream reading complete.");
    } catch (err: any) {
      console.error("❌ [Chat UI] Fetch streaming failed:", err);
      // Append a system error bubble
      addMessage({
        id: `msg-${Date.now()}-error`,
        role: "system",
        content: `Connection error: ${err.message || "Unable to reach the health assistant. Please verify your connection."}`,
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)]">
        {/* Geolocation Warning Banner (Optional notification) */}
        {gpsError && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-xs text-amber-600 dark:text-amber-500 font-medium mb-3 border border-amber-500/20">
            <Compass className="h-4 w-4 animate-spin-slow shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Chat Bubbles Container */}
        <div
          className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 max-w-sm mx-auto">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-primary mb-4 shadow-inner">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h1 className="font-heading text-xl font-bold tracking-tight">
                Consult SwasthyaAI
              </h1>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Describe symptoms like &quot;I have sudden high fever and joint pain&quot; or &quot;severe chest pain&quot; to start an assessment.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                onSpeak={speakText}
                isCurrentlySpeaking={isSpeaking}
                onStopSpeaking={stopSpeaking}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
        <div className="pt-3 border-t bg-background">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            {/* Input Bar */}
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe symptoms or ask health questions..."
              disabled={isLoading}
              className="flex-1 rounded-xl border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-75"
            />

            {/* Mic Toggle Button */}
            {voiceSupported && (
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
                  isListening
                    ? "bg-red-500 text-white border-red-500 animate-pulse"
                    : "glass hover:bg-muted text-muted-foreground"
                )}
                title={isListening ? "Stop listening" : "Start dictating"}
              >
                {isListening ? (
                  <MicOff className="h-4.5 w-4.5" />
                ) : (
                  <Mic className="h-4.5 w-4.5" />
                )}
              </button>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary hover:bg-teal-600 text-white transition-all disabled:opacity-50 disabled:hover:bg-primary shadow-md shadow-primary/10 active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <Send className="h-4.5 w-4.5" />
              )}
            </button>

            {/* Clear Button */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  clearChat();
                }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border glass hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                title="Clear conversations"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            )}
          </form>
        </div>
      </div>
    </AppShell>
  );
}
