# ARCHITECTURE.md

# SwasthyaAI V2 Architecture

## AI-Powered Multilingual Voice Healthcare Assistant

Version: 2.0

---

# Vision

SwasthyaAI is an AI-powered multilingual healthcare awareness and triage platform designed for Indian users.

The system provides:

* Voice-to-Voice Healthcare Assistant
* Text Chat Assistant
* Disease Awareness Guidance
* Retrieval Augmented Generation (RAG)
* Smart Hospital Finder
* Emergency Escalation
* Route Navigation
* Emotional AI Voice Responses
* Multilingual Communication

The goal is not diagnosis.

The goal is:

* Early Awareness
* Symptom Guidance
* Risk Assessment
* Hospital Discovery
* Emergency Assistance

---

# High-Level Architecture

```text
┌─────────────────────────────────────┐
│            End User                 │
└─────────────────────────────────────┘
                  │
                  ▼

      Voice Input OR Text Input

                  │
                  ▼

┌─────────────────────────────────────┐
│ Speech-To-Text Layer                │
│ OpenAI GPT-4o Mini Transcribe       │
└─────────────────────────────────────┘

                  │
                  ▼

┌─────────────────────────────────────┐
│ Language Detection Layer            │
└─────────────────────────────────────┘

                  │
                  ▼

┌─────────────────────────────────────┐
│ Conversation Memory                 │
│ Zustand Store                       │
└─────────────────────────────────────┘

                  │
                  ▼

┌─────────────────────────────────────┐
│ RAG Retrieval Engine                │
└─────────────────────────────────────┘

                  │
                  ▼

┌─────────────────────────────────────┐
│ Medical LLM Agent                   │
│ GPT-4o Mini / OpenRouter            │
└─────────────────────────────────────┘

                  │
                  ▼

┌─────────────────────────────────────┐
│ Tool Calling Layer                  │
└─────────────────────────────────────┘

      ┌───────────┬────────────┬────────────┐
      ▼           ▼            ▼
 Disease Tool  Hospital Tool  Maps Tool

                  │
                  ▼

┌─────────────────────────────────────┐
│ Final Medical Guidance              │
└─────────────────────────────────────┘

                  │
                  ▼

┌─────────────────────────────────────┐
│ Emotional Voice Synthesis           │
│ Hume AI                             │
└─────────────────────────────────────┘

                  │
                  ▼

             User Response
```

---

# User Interaction Modes

## Mode 1

Text → AI → Text

---

## Mode 2

Voice → Whisper → AI → Text

---

## Mode 3

Voice → Whisper → AI → Hume AI → Voice

---

# Voice Processing Pipeline

## Input

User speaks:

* Marathi
* Hindi
* English
* Telugu
* Tamil
* Kannada
* Bengali
* Gujarati
* Punjabi
* Malayalam
* Mandarin

No language selector required.

System automatically detects language.

---

## Speech Recognition

Provider:

OpenAI GPT-4o Mini Transcribe

Responsibilities:

* Speech Recognition
* Language Detection
* Accent Handling
* Medical Term Recognition

Output:

```json
{
  "transcript": "...",
  "language": "mr",
  "confidence": 0.96
}
```

---

# Language Intelligence Layer

Purpose:

Maintain same language throughout conversation.

Example:

User:
"मला ताप आला आहे"

Response:

Must remain Marathi.

Never switch to English.

Unless explicitly requested.

Store:

```typescript
preferredLanguage
```

inside Zustand.

---

# RAG Architecture

## Purpose

Prevent hallucinations.

Provide verified healthcare guidance.

---

## Sources

WHO

CDC

Ayushman Bharat

National Health Mission

Medical Knowledge Base

Government Health Portals

Local Disease Database

---

## Retrieval Flow

```text
User Query
      │
      ▼

Embedding Model

      │
      ▼

Vector Database

      │
      ▼

Top Relevant Chunks

      │
      ▼

LLM Context
```

---

# Vector Database

Primary:

Pinecone

Fallback:

Local Knowledge Store

---

# Medical Agent

Provider:

OpenRouter

Preferred Model:

GPT-4o Mini

Fallback Models:

Gemini 2.5 Flash

Claude Sonnet

DeepSeek V3

Responsibilities:

* Symptom Analysis
* Context Understanding
* Tool Calling
* Risk Assessment
* Response Generation

The model must NEVER diagnose.

Instead use:

Possible Concern

Potential Risk

Recommended Action

---

# Tool Calling Architecture

The LLM decides when tools are needed.

---

## Tool 1

getDiseaseInformation()

Returns:

* Symptoms
* Risk Factors
* Prevention
* Awareness Information

---

## Tool 2

getNearbyHospitals()

Input:

```json
{
  "lat": 0,
  "lng": 0,
  "suspectedDisease": ""
}
```

Returns:

Top Ranked Hospitals

---

## Tool 3

getHospitalDirections()

Returns:

Route

Travel Time

Distance

Coordinates

---

## Tool 4

getOutbreakAlerts()

Returns:

Local Disease Outbreaks

Government Alerts

Risk Zones

---

# Smart Hospital Ranking Engine

Ranking Formula:

```text
Hospital Score

=
Speciality Match (40%)

+
Distance (25%)

+
Emergency Capability (15%)

+
Ratings (10%)

+
Availability (10%)
```

---

# Hospital Categories

Cardiology

Neurology

Orthopedic

Pulmonology

Infectious Diseases

Pediatrics

Gynecology

Emergency Trauma

Multi-Speciality

---

# Example

User:

"I have chest pain"

AI:

1. Retrieve RAG Data

2. Assess Risk

3. Call Hospital Finder

4. Find Cardiology Hospital

5. Call Directions Tool

6. Display Route

7. Generate Voice Response

---

# Navigation System

Map Provider:

Google Maps

Fallback:

OpenStreetMap

Features:

* Current Location
* Hospital Marker
* Route Drawing
* ETA
* Distance

---

# Emergency Escalation System

Trigger Conditions:

* Heart Attack Symptoms
* Stroke Symptoms
* Severe Bleeding
* Breathing Difficulty
* Unconsciousness

---

# Emergency Flow

```text
Symptoms
    │
    ▼

Emergency Detection

    │
    ▼

Hospital Finder

    │
    ▼

Directions Tool

    │
    ▼

Emergency Banner

    │
    ▼

Urgent Voice Response
```

---

# Hume AI Voice Layer

Primary TTS:

Hume AI

Fallback:

GPT-4o Mini TTS

---

# Emotional Voice Modes

## Calm

General Awareness

---

## Empathetic

Mental Health

---

## Reassuring

Moderate Symptoms

---

## Urgent

Emergency Cases

---

# Response Format

```json
{
  "response": "...",
  "triageLevel": "low",
  "emergency": false,
  "hospitalRequired": false,
  "directionsRequired": false,
  "language": "mr"
}
```

---

# Frontend Components

```text
src/components/chat

ChatWindow

ChatBubble

VoiceRecorder

VoicePlayer

TypingIndicator

ToolResultCard

EmergencyCard

HospitalCard

DirectionsMap
```

---

# API Routes

```text
/api/chat

/api/voice/transcribe

/api/voice/speak

/api/hospitals

/api/directions

/api/outbreaks
```

---

# Environment Variables

```env
OPENAI_API_KEY=

OPENROUTER_API_KEY=

PINECONE_API_KEY=

PINECONE_INDEX=

HUME_API_KEY=

GOOGLE_MAPS_API_KEY=
```

---

# Deployment

Frontend:

Vercel

Backend:

Next.js Route Handlers

Vector DB:

Pinecone

Maps:

Google Maps

Voice:

OpenAI + Hume

---

# Healthcare Safety Rules

Never diagnose.

Never prescribe medicine.

Never replace doctors.

Always recommend professional consultation for severe symptoms.

Always display:

"AI-generated guidance does not replace professional medical advice."

---

# Hackathon Differentiators

1. Multilingual Voice Assistant

2. Emotion-Aware Voice Responses

3. Smart Hospital Ranking

4. Emergency Auto Navigation

5. RAG-Based Healthcare Knowledge

6. Real-Time Directions

7. Rural Accessibility

8. Indian Language Support

9. Context-Aware Tool Calling

10. Voice-to-Voice Healthcare Guidance

This architecture should be implemented incrementally while preserving existing SwasthyaAI functionality and maintaining backward compatibility with the current codebase.
