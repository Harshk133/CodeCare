# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Next.js dev server (localhost:3000)
npm run build      # Static export build → out/ (next.config.ts sets output: "export")
npm run lint       # ESLint check (lint is skipped during `next build`)
npm run format     # Prettier format (writes in place)

# Android (Capacitor, webDir = out/)
npm run mobile:android         # scripts/build-android.ps1: build, add platform if missing, patch AndroidManifest permissions, sync, open Android Studio
npm run mobile:android:device  # same, but runs on a connected device
npm run mobile:sync            # npx cap sync android (after a build)

# Utility scripts (load .env.local via dotenv)
npx jiti scripts/seed-db.ts    # Embed DISEASES_KNOWLEDGE into the Pinecone index
npx jiti scripts/test-chat.ts  # Smoke-test POST /api/chat (hardcoded to localhost:3001)
```

There is no test suite configured. Type-checking is done via `tsc --noEmit` (not in scripts, run manually if needed).

## Web vs. Native Runtime

The same Next.js app ships as a website and as a Capacitor Android app. Inside the Capacitor WebView there is no Next.js server, so:
- **All client-side API calls must go through `getApiUrl()`** (`src/lib/getApiUrl.ts`). It returns relative paths in the browser and prefixes `NEXT_PUBLIC_API_BASE_URL` (default `https://swasthya-ai.vercel.app`) when native. Only set that var for Capacitor builds — setting it locally sends every request to Vercel.
- Native-vs-browser differences (geolocation permission, mic pre-warm, status bar) live in `src/hooks/useNativeBridge.ts`; Capacitor plugins are dynamically imported so the web build doesn't break.
- Because of the static export, dynamic routes need `generateStaticParams` (see `awareness/[disease]/page.tsx`).
- New external domains the app calls must be added to `server.allowNavigation` in `capacitor.config.ts`.

## Environment Setup

Copy `.env.example` to `.env.local`. The app has a built-in simulation mode when API keys are missing — set `NEXT_PUBLIC_SIMULATION_MODE=true` to run fully offline with no external API calls.

Key env vars:
- `NEXT_PUBLIC_AI_PROVIDER` — `openrouter` (default in code) or `gemini`; falls back to the other provider, then simulation, if the chosen key is missing
- `NEXT_PUBLIC_GEMINI_API_KEY` / `OPENROUTER_API_KEY` — at least one required for live AI; `OPENROUTER_MODEL` defaults to `openai/gpt-4o-mini`, Gemini uses `gemini-2.0-flash`
- `GOOGLE_MAPS_API_KEY` (server) — enables live Google Places results in `/api/hospitals`, `/api/directions`, and the `getNearbyHospitals` tool; otherwise mock hospitals are returned
- `PINECONE_API_KEY` + `PINECONE_INDEX` — required for vector RAG (falls back to local keyword search if absent)
- `OPENAI_API_KEY` — required for cloud voice (Whisper STT + TTS); can be routed via OpenRouter by setting `OPENAI_API_BASE_URL`
- `HUME_API_KEY` — optional empathic TTS (Hume AI); falls back to OpenAI TTS if unavailable
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — optional; hospital map defaults to Leaflet/OpenStreetMap without it

## Architecture

### AI Chat Pipeline (`src/app/api/chat/route.ts`)

The core flow on every POST:
1. **RAG retrieval** — `queryRAG()` fetches relevant medical context (Pinecone or local fallback)
2. **Provider selection** — resolves to Gemini, OpenRouter, or simulation mode based on available keys
3. **Streaming** — uses Vercel AI SDK `streamText` with three registered tools: `getDiseaseInformation`, `getNearbyHospitals`, `getOutbreakAlerts`
4. **Structured metadata** — the system prompt instructs the model to embed `<triage>`, `<emergency>`, and `<hospitals>` JSON blocks inside the streamed text

The simulation mode (`handleSimulatedStream`) produces the same tag-embedded format without any external API call, enabling offline development.

### Structured Response Rendering (`src/components/chat/ChatBubble.tsx`)

`ChatBubble` parses the raw streamed assistant content by regex-extracting the XML-like tags, renders them as rich UI cards (triage risk badge, emergency action card, hospital map), then displays the cleaned markdown text below. `HospitalMap` is dynamically imported with `ssr: false` to avoid Leaflet SSR issues.

### RAG Service (`src/services/ragService.ts`)

Two-mode retrieval:
- **Pinecone mode**: embeds the query via `gemini-embedding-001`, queries the vector index for top-3 matches
- **Local keyword mode**: scores diseases in `DISEASES_KNOWLEDGE` by direct name match, category, symptom substring, and emergency trigger keywords; returns top-2 disease profiles as formatted context strings

The local fallback is always used when `NEXT_PUBLIC_SIMULATION_MODE=true` or when Pinecone/Gemini keys are absent.

### Voice Pipeline

Two interchangeable engines exposed via a unified interface (`isListening`, `transcript`, `speakText`, `stopSpeaking`, `hasSupport`):

- **Local (`useSpeech`)** — browser Web Speech API (SpeechRecognition + SpeechSynthesis). Language-aware via `SPEECH_LANG_MAP` keyed to `LanguageCode`.
- **Cloud (`useCloudSpeech`)** — MediaRecorder → `POST /api/voice/transcribe` (Whisper) for STT; `POST /api/voice/speak` (Hume AI → OpenAI TTS fallback) for TTS.

`ChatClient` selects the active engine via a toggle and delegates to whichever hook is active. Voice submissions auto-trigger TTS playback of the assistant response.

### State Management (`src/store/useHealthStore.ts`)

Zustand store with `persist` middleware (localStorage key `swasthya-ai-store`). Persists: `language`, `userLocation`, `messages`, `theme`. `messages` is the full conversation history passed as context to the API on every submission.

### Medical Knowledge Base (`src/constants/medicalKnowledge.ts`)

Static in-memory dataset of diseases (`DISEASES_KNOWLEDGE`) and mock outbreak alerts (`MOCK_OUTBREAKS`). Each disease entry includes symptoms, WHO guidelines, allopathic treatment, homeopathic remedies, emergency triggers, and prevention steps. This is the sole source of truth for local RAG and for the `getDiseaseInformation` tool.

### Hospital Data

Google Places (New) `searchNearby` when `GOOGLE_MAPS_API_KEY` is set; otherwise mock data — `MOCK_HOSPITALS` in `src/app/api/chat/route.ts` for the chat tool, and a separate `getMockHospitals()` in `src/app/api/hospitals/route.ts` for the hospitals page. Distance is approximated using Euclidean lat/lng difference × 111 km/degree. The `getNearbyHospitals` tool sorts by specialty match first, then proximity.

### Pages / Routes

- `/` — Landing page
- `/chat` — Main AI chat interface (`ChatClient`)
- `/hospitals` — Dedicated hospital finder with geolocation and map (`HospitalsClient`)
- `/awareness` — Disease awareness listing; `/awareness/[disease]` — detail page
- `/alerts` — Outbreak alerts page
