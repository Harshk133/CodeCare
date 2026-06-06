# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Next.js dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint check
npm run format     # Prettier format (writes in place)
```

There is no test suite configured. Type-checking is done via `tsc --noEmit` (not in scripts, run manually if needed).

## Environment Setup

Copy `.env.example` to `.env.local`. The app has a built-in simulation mode when API keys are missing — set `NEXT_PUBLIC_SIMULATION_MODE=true` to run fully offline with no external API calls.

Key env vars:
- `NEXT_PUBLIC_AI_PROVIDER` — `gemini` (default) or `openrouter`
- `NEXT_PUBLIC_GEMINI_API_KEY` / `OPENROUTER_API_KEY` — at least one required for live AI
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

Currently mock data hardcoded in `src/app/api/chat/route.ts` (`MOCK_HOSPITALS`). Distance is approximated using Euclidean lat/lng difference × 111 km/degree. The `getNearbyHospitals` tool sorts by specialty match first, then proximity.

### Pages / Routes

- `/` — Landing page
- `/chat` — Main AI chat interface (`ChatClient`)
- `/hospitals` — Dedicated hospital finder with geolocation and map (`HospitalsClient`)
- `/awareness` — Disease awareness listing; `/awareness/[disease]` — detail page
- `/alerts` — Outbreak alerts page
