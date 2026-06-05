# SwasthyaAI V2 — Implementation Plan

**Branch:** `feature/voice-to-voice-assistance`  
**Date:** 2026-06-06  
**Goal:** Fully wire up voice-to-voice pipeline, Google Maps real data, Hume AI Hindi voices, and upgrade transcription to `gpt-4o-mini-transcribe`.

---

## Research Findings

### 1. OpenAI `gpt-4o-mini-transcribe`

| Item | Value |
|------|-------|
| Model ID | `gpt-4o-mini-transcribe` (latest snapshot: `gpt-4o-mini-transcribe-2025-12-15`) |
| Endpoint | `POST /v1/audio/transcriptions` |
| Auth | `Authorization: Bearer $OPENAI_API_KEY` |
| Max file size | 25 MB |
| Supported formats | mp3, mp4, mpeg, mpga, m4a, wav, webm |
| `response_format` | `json` or `text` (no `verbose_json` — that's whisper-1 only) |
| Language detection | Returned in `json` response as `language` field |
| Advantages over whisper-1 | Lower word error rate, better handling of short utterances and noisy audio, supports 99+ languages |
| OpenRouter model ID | `openai/gpt-4o-mini-transcribe` |
| Pricing | $1.25/1M input audio tokens |

**Request example:**
```ts
const formData = new FormData();
formData.append("file", audioFile, "audio.webm");
formData.append("model", "gpt-4o-mini-transcribe");
formData.append("response_format", "json");
// optionally: formData.append("language", "hi"); // skip for auto-detect

const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  body: formData,
});
const data = await res.json();
// data.text  → transcript
// data.language → ISO 639-1 code e.g. "hi", "mr", "en"
```

---

### 2. Hume AI TTS — Octave 2

| Item | Value |
|------|-------|
| Endpoint (non-streaming file) | `POST https://api.hume.ai/v0/tts/file` |
| Endpoint (streaming) | `POST https://api.hume.ai/v0/tts/stream/json` |
| Auth | Header: `X-Hume-Api-Key: $HUME_API_KEY` |
| Model | Octave 2 (pass `"version": "2"`) |
| Supported languages | English, Hindi, Japanese, Korean, Spanish, French, Portuguese, Italian, German, Russian, Arabic |
| Audio formats | `mp3`, `wav`, `pcm` |
| Voice naming | By name: `{ "name": "Suresh", "provider": "HUME_AI" }` OR by id |
| Hindi voices requested | **Suresh** (male), **Arjun** (male), **Priya** (female) |
| Max text per utterance | 5,000 characters |
| Voice Library endpoint | `GET /v0/tts/voices` (to list all preset voices) |

**Request example with Hindi voice:**
```ts
const res = await fetch("https://api.hume.ai/v0/tts/file", {
  method: "POST",
  headers: {
    "X-Hume-Api-Key": process.env.HUME_API_KEY!,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    utterances: [
      {
        text: cleanedText,
        description: "A warm, professional healthcare assistant speaking clearly and calmly.",
        voice: {
          name: "Priya",        // or "Suresh" or "Arjun"
          provider: "HUME_AI",
        },
      },
    ],
    format: { type: "mp3" },
    version: "2",
  }),
});
```

**Voice tone modes mapping to `description`:**
- `calm` → `"A calm, clear healthcare educator voice"`
- `empathetic` → `"A warm, empathetic counselor voice with gentle reassurance"`
- `reassuring` → `"A reassuring, professional doctor voice"`
- `urgent` → `"An urgent, direct medical emergency responder voice"`

---

### 3. Google Maps — Real Hospital Search + Directions

**APIs needed (enable in Google Cloud Console):**
- Maps JavaScript API (for `GoogleMap` component — already wired)
- Places API (New) — for real nearby hospital search
- Directions API (Legacy) — for routing (already wired in `HospitalMap.tsx`)

**Places Nearby Search (New) — POST:**
```
POST https://places.googleapis.com/v1/places:searchNearby
X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY
X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.types,places.rating
Content-Type: application/json

{
  "includedTypes": ["hospital", "doctor", "health"],
  "maxResultCount": 10,
  "locationRestriction": {
    "circle": {
      "center": { "latitude": 18.5204, "longitude": 73.8567 },
      "radius": 5000.0
    }
  }
}
```

**Directions API (already in `HospitalMap.tsx`) — confirming shape:**
```ts
directionsService.route({
  origin: new google.maps.LatLng(userLat, userLng),
  destination: new google.maps.LatLng(hospLat, hospLng),
  travelMode: google.maps.TravelMode.DRIVING,
}, (result, status) => { ... })
```

---

## Current State Audit

| Feature | Status | Notes |
|---------|--------|-------|
| Text chat + streaming | ✅ Done | Gemini/OpenRouter/simulation |
| RAG (Pinecone + local fallback) | ✅ Done | |
| `getDiseaseInformation` tool | ✅ Done | |
| `getNearbyHospitals` tool | ✅ Done (mock data) | Needs real Places API |
| `getOutbreakAlerts` tool | ✅ Done (mock data) | |
| `getHospitalDirections` tool | ❌ Missing | New tool needed |
| Directions in HospitalMap | ✅ Done | Google Maps DirectionsRenderer wired |
| Leaflet fallback map | ✅ Done | |
| Local voice (Web Speech API) | ✅ Done | `useSpeech.ts` |
| Cloud STT (whisper-1) | ✅ Done | `/api/voice/transcribe` |
| Cloud TTS (Hume AI) | ⚠️ Partial | No voice names, no tone, no Octave 2 |
| `gpt-4o-mini-transcribe` | ❌ Not upgraded | Still uses whisper-1 |
| Language detection from audio | ❌ Missing | |
| Auto language persistence | ❌ Missing | Zustand `language` not set from transcription |
| Hindi voice selector (Suresh/Priya/Arjun) | ❌ Missing | |
| Real Places API hospital search | ❌ Missing | Mock data only |
| `/api/hospitals` route | ❌ Missing | |
| `/api/directions` route | ❌ Missing | |
| Primary model: OpenRouter GPT-4o-mini | ⚠️ Partial | OpenRouter works, model not enforced |

---

## Implementation Phases

---

### Phase 1 — Upgrade Transcription to `gpt-4o-mini-transcribe` + Language Detection

**File:** `src/app/api/voice/transcribe/route.ts`

**Changes:**
- Switch model from `whisper-1` → `gpt-4o-mini-transcribe`
- Set `response_format: json` (returns `{ text, language }`)
- Return `language` field to client
- Map ISO 639-1 code → `LanguageCode` type (`hi` → `"hi"`, `mr` → `"mr"`, etc.)

**File:** `src/hooks/useCloudSpeech.ts`
- Update `transcribeAudio()` to read `data.language` from response
- Return `detectedLanguage` from the hook

**File:** `src/app/chat/ChatClient.tsx`
- After voice transcription, call `useHealthStore.getState().setLanguage(detectedLanguage)` if detected language differs

---

### Phase 2 — Hume AI TTS with Hindi Voice Names + Tone Selection

**File:** `src/app/api/voice/speak/route.ts`

**Changes:**
- Accept optional `voice` and `tone` in request body
- Voice options: `"Suresh"` | `"Priya"` | `"Arjun"`
- Tone maps to Hume `description` field (calm/empathetic/reassuring/urgent)
- Upgrade to Octave 2: add `"version": "2"` to request body
- Voice specified as `{ name: voiceName, provider: "HUME_AI" }`

**File:** `src/hooks/useCloudSpeech.ts`
- `speakText(text, options?: { voice?: string, tone?: string })` signature

**File:** `src/app/chat/ChatClient.tsx`
- Add voice selector UI showing Suresh / Priya / Arjun
- Pass selected voice when calling `speech.speakText()`
- Auto-select voice based on language (e.g., Hindi → Priya by default)

**New Component:** `src/components/chat/VoiceSelector.tsx`
- Compact selector: 3 avatar cards (Suresh ♂ | Priya ♀ | Arjun ♂)
- Persisted to Zustand store (add `preferredVoice` field)

---

### Phase 3 — Google Maps Real Hospital Search

**New API Route:** `src/app/api/hospitals/route.ts`

```ts
// POST /api/hospitals
// Body: { latitude, longitude, radius?, type? }
// Calls Google Places API (New) Nearby Search
// Returns normalized hospital list
```

**File:** `src/app/api/chat/route.ts` — `getNearbyHospitals` tool
- When `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set and simulation is off, call `/api/hospitals` internally
- Fall back to mock data otherwise

**File:** `src/app/hospitals/HospitalsClient.tsx`
- Replace `ALL_MOCK_HOSPITALS` with `fetch('/api/hospitals', { body: coords })` call

---

### Phase 4 — `getHospitalDirections` Tool + `/api/directions` Route

**New API Route:** `src/app/api/directions/route.ts`

```ts
// POST /api/directions
// Body: { origin: { lat, lng }, destination: { lat, lng } }
// Calls Google Directions REST API
// Returns: distance, duration, steps, polyline
```

**File:** `src/app/api/chat/route.ts` — add 4th tool:

```ts
getHospitalDirections: tool({
  description: "Get driving directions, ETA, and distance from user location to a hospital",
  parameters: z.object({
    originLat: z.number(),
    originLng: z.number(),
    destinationLat: z.number(),
    destinationLng: z.number(),
    hospitalName: z.string().optional(),
  }),
  execute: async ({ originLat, originLng, destinationLat, destinationLng }) => {
    // Call Google Directions REST API
    // Return distance, duration
  }
})
```

**System prompt update:** Add `<directions>` structured metadata tag alongside existing `<triage>`, `<emergency>`, `<hospitals>` tags.

**File:** `src/components/chat/ChatBubble.tsx`
- Parse `<directions>` tag and render a directions summary card with ETA + distance

---

### Phase 5 — Zustand Store: Language + Voice Persistence

**File:** `src/store/useHealthStore.ts`
- Add `preferredVoice: "Suresh" | "Priya" | "Arjun"` field (default: `"Priya"`)
- Add `setPreferredVoice(voice)` action
- Add to `partialize` so it persists to localStorage
- Ensure `setLanguage` is called from transcription result

---

### Phase 6 — Primary Model: OpenRouter + GPT-4o-mini

**File:** `src/app/api/chat/route.ts`
- Set `NEXT_PUBLIC_AI_PROVIDER` default to `"openrouter"`
- Set `OPENROUTER_MODEL` default to `"openai/gpt-4o-mini"`
- Update system prompt to include `preferredLanguage` from store (passed via request body)
- Update request body in `ChatClient.tsx` to include `language` field

**File:** `.env.example`
- Update `NEXT_PUBLIC_AI_PROVIDER=openrouter`
- Update `OPENROUTER_MODEL=openai/gpt-4o-mini`

---

## New Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/hospitals/route.ts` | Google Places API nearby hospital search |
| `src/app/api/directions/route.ts` | Google Directions REST API proxy |
| `src/components/chat/VoiceSelector.tsx` | Hindi voice picker UI (Suresh/Priya/Arjun) |

---

## Updated Files

| File | Changes |
|------|---------|
| `src/app/api/voice/transcribe/route.ts` | gpt-4o-mini-transcribe, return language |
| `src/app/api/voice/speak/route.ts` | Hume Octave 2, voice names, tone descriptions |
| `src/app/api/chat/route.ts` | Add directions tool, language in system prompt, default OpenRouter |
| `src/hooks/useCloudSpeech.ts` | Return detectedLanguage, accept voice/tone in speakText |
| `src/app/chat/ChatClient.tsx` | Auto-language from transcription, voice selector |
| `src/components/chat/ChatBubble.tsx` | Parse `<directions>` tag |
| `src/store/useHealthStore.ts` | Add preferredVoice field |
| `src/app/hospitals/HospitalsClient.tsx` | Real Places API data |
| `.env.example` | New env vars |

---

## Required Credentials

The following API keys are needed to proceed with implementation:

| Key | Purpose | Where to get |
|-----|---------|--------------|
| `OPENAI_API_KEY` | gpt-4o-mini-transcribe STT + TTS fallback | platform.openai.com |
| `HUME_API_KEY` | Hume AI Octave 2 TTS (Suresh/Priya/Arjun voices) | app.hume.ai |
| `OPENROUTER_API_KEY` | GPT-4o-mini medical agent | openrouter.ai |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JS API + Places API + Directions API | console.cloud.google.com |
| `PINECONE_API_KEY` + `PINECONE_INDEX` | Vector RAG (optional, local fallback exists) | pinecone.io |
| `NEXT_PUBLIC_GEMINI_API_KEY` | Gemini embedding for RAG (optional) | aistudio.google.com |

**Google Cloud APIs to enable for the Maps key:**
- Maps JavaScript API
- Places API (New)
- Directions API (Legacy)

---

## Implementation Order

1. Phase 5 (Zustand) — no external deps, unblocks everything
2. Phase 1 (Transcription upgrade) — needs `OPENAI_API_KEY`
3. Phase 2 (Hume TTS voices) — needs `HUME_API_KEY`
4. Phase 3 (Real hospital search) — needs `GOOGLE_MAPS_API_KEY`
5. Phase 4 (Directions tool) — needs `GOOGLE_MAPS_API_KEY`
6. Phase 6 (Model switch) — needs `OPENROUTER_API_KEY`
