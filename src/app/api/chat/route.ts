import { streamText, tool, stepCountIs, jsonSchema } from "ai";
import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { queryRAG } from "@/services/ragService";
import { DISEASES_KNOWLEDGE, MOCK_OUTBREAKS } from "@/constants/medicalKnowledge";

export const maxDuration = 60;

const MOCK_HOSPITALS = [
  {
    id: "hosp-1", name: "Sanjeevan Specialty Hospital", distance: 1.2,
    address: "Deccan Gymkhana, Pune, Maharashtra 411004", phone: "+91 20 2567 8000",
    hasEmergency24_7: true, coordinates: { latitude: 18.5144, longitude: 73.8412 },
    specialties: ["dengue", "malaria", "fever", "infectious diseases"],
  },
  {
    id: "hosp-2", name: "Kamla Nehru Municipal Hospital", distance: 2.8,
    address: "Mangalwar Peth, Pune, Maharashtra 411011", phone: "+91 20 2447 3012",
    hasEmergency24_7: true, coordinates: { latitude: 18.5282, longitude: 73.8631 },
    specialties: ["dengue", "malaria", "tuberculosis", "general medicine"],
  },
  {
    id: "hosp-3", name: "Ruby Hall Clinic (Emergency Care)", distance: 4.1,
    address: "Sassoon Road, Pune, Maharashtra 411001", phone: "+91 20 6645 5100",
    hasEmergency24_7: true, coordinates: { latitude: 18.5325, longitude: 73.8788 },
    specialties: ["cardiology", "stroke", "emergency", "intensive care", "breathing distress"],
  },
  {
    id: "hosp-4", name: "Primary Health Centre (PHC) Mulshi", distance: 15.4,
    address: "Mulshi Road, Maharashtra 411042", phone: "+91 20 2292 2011",
    hasEmergency24_7: false, coordinates: { latitude: 18.5085, longitude: 73.6195 },
    specialties: ["fever", "malaria", "general medicine", "vaccination"],
  },
  {
    id: "hosp-5", name: "Kolkata Medical College Wards", distance: 1.8,
    address: "College Street, Kolkata, West Bengal 700073", phone: "+91 33 2241 4901",
    hasEmergency24_7: true, coordinates: { latitude: 22.5746, longitude: 88.3639 },
    specialties: ["dengue", "malaria", "infectious diseases", "general medicine"],
  },
];

function scoreHospitals(hospitals: typeof MOCK_HOSPITALS, lat: number, lng: number, diseaseId: string) {
  return hospitals.map((h) => {
    const dist = Math.sqrt(
      Math.pow(h.coordinates.latitude - lat, 2) + Math.pow(h.coordinates.longitude - lng, 2)
    ) * 111;
    const matchesSpecialty = diseaseId
      ? h.specialties.some((s) => s.toLowerCase().includes(diseaseId.toLowerCase()))
      : false;
    return { ...h, distance: parseFloat(dist.toFixed(1)), matchesSpecialty };
  }).sort((a, b) => {
    if (a.matchesSpecialty && !b.matchesSpecialty) return -1;
    if (!a.matchesSpecialty && b.matchesSpecialty) return 1;
    return a.distance - b.distance;
  });
}

export async function POST(req: Request) {
  console.log("\x1b[35m%s\x1b[0m", "\n📥 [API Route] Received Chat Request...");

  try {
    const { messages, userLocation, language } = await req.json();

    // Filter out system-role error messages before sending to LLM
    const llmMessages = messages.filter((m: { role: string }) => m.role !== "system");
    const latestMessage = llmMessages[llmMessages.length - 1];
    const userQuery: string = latestMessage?.content ?? "";

    console.log(`  - Latest query: "${userQuery}"`);
    console.log(`  - Language: ${language || "auto"} | Location: ${userLocation ? `[${userLocation.latitude}, ${userLocation.longitude}]` : "none"}`);

    const medicalContext = await queryRAG(userQuery);
    console.log("⚡ [API Route] RAG retrieval complete.");

    if (process.env.NEXT_PUBLIC_GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    }

    const provider = process.env.NEXT_PUBLIC_AI_PROVIDER || "openrouter";
    const hasGeminiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !!process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
    let isSimulationMode = process.env.NEXT_PUBLIC_SIMULATION_MODE === "true";
    let activeProvider = provider;

    if (provider === "openrouter" && !hasOpenRouterKey) {
      activeProvider = hasGeminiKey ? "gemini" : "simulation";
      if (!hasGeminiKey) isSimulationMode = true;
    } else if (provider === "gemini" && !hasGeminiKey) {
      activeProvider = hasOpenRouterKey ? "openrouter" : "simulation";
      if (!hasOpenRouterKey) isSimulationMode = true;
    } else if (!hasGeminiKey && !hasOpenRouterKey) {
      isSimulationMode = true;
    }

    if (isSimulationMode) {
      console.log("🌐 [API Route] Simulation mode active.");
      return handleSimulatedStream(userQuery, userLocation, medicalContext);
    }

    let modelInstance: ReturnType<typeof google> | ReturnType<ReturnType<typeof createOpenAI>["chat"]>;

    if (activeProvider === "openrouter") {
      const openrouter = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        headers: { "HTTP-Referer": "https://swasthya-ai.vercel.app", "X-Title": "SwasthyaAI" },
        fetch: async (url, options) => {
          console.log("✈️ [Fetch Interceptor] Request URL:", url);
          if (options?.body) {
            console.log("✈️ [Fetch Interceptor] Request Body:\n", JSON.stringify(JSON.parse(options.body as string), null, 2));
          }
          return fetch(url, options);
        }
      });
      const modelName = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
      console.log(`🤖 [API Route] OpenRouter model: [${modelName}]`);
      modelInstance = openrouter.chat(modelName);
    } else {
      console.log("🤖 [API Route] Google Gemini-2.0-Flash");
      modelInstance = google("gemini-2.0-flash");
    }

    const langInstruction = language === "hi" || language === "mr"
      ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY SCRIPT RULE — देवनागरी लिपि (DEVANAGARI ONLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST write your entire response in DEVANAGARI script — the script used for Hindi and Marathi in India.

✅ CORRECT Devanagari example:
"आपको बुखार है। पानी पीते रहें। पैरासिटामोल ले सकते हैं।
अस्वीकरण: मैं एक AI सहायक हूँ, डॉक्टर नहीं।"

❌ STRICTLY FORBIDDEN — Urdu/Arabic script (do NOT use these characters):
ا ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ہ ی

❌ STRICTLY FORBIDDEN — Roman/English script in the prose text.

RULES:
• Use ONLY Devanagari Unicode characters (U+0900–U+097F) for all prose text.
• End every sentence with the Devanagari danda "।" — NOT a period ".".
• The JSON inside <triage>, <emergency>, <hospitals>, <directions> tags may remain in English/ASCII — only the prose text outside tags must be Devanagari.
• Medical terms (dengue, malaria, paracetamol) should be written in Devanagari phonetics: डेंगू, मलेरिया, पैरासिटामोल।
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      : language && language !== "en"
      ? `\nIMPORTANT: Respond entirely in ${language}. Do not use English.`
      : "";

    const systemPrompt = `You are SwasthyaAI, a multilingual public health assistant for Indian users.
Your goals: raise disease awareness, provide symptom-based triage guidance, and map nearby hospitals.
${langInstruction}

CRITICAL RULES:
1. Always include a medical disclaimer — you are an AI assistant, not a doctor.
2. NEVER diagnose with certainty. Use phrases like "possible concern" or "suggests risk of".
3. NEVER prescribe specific medications. Only mention common OTC options (Paracetamol, ORS) for mild symptoms.
4. Detect emergencies: chest pain, numbness, facial drooping, blue lips, severe breathing difficulty, unconsciousness → trigger emergency alert.
5. Embed structured metadata tags for the UI in your response text:

   For triage:
   <triage>
   {"riskLevel":"low"|"medium"|"high"|"emergency","concerns":[...],"actions":[...],"reasoning":"..."}
   </triage>

   For emergencies:
   <emergency>
   {"symptom":"...","immediateActions":[...]}
   </emergency>

   For hospital recommendations (after calling getNearbyHospitals):
   <hospitals>
   {"userLocation":{"latitude":...,"longitude":...},"hospitals":[{"name":"...","distance":1.2,"address":"...","phone":"...","coordinates":{"latitude":...,"longitude":...},"specialties":[...],"hasEmergency24_7":true,"matchesSpecialty":false}]}
   </hospitals>

   For directions (after calling getHospitalDirections):
   <directions>
   {"hospitalName":"...","distance":"4.2 km","duration":"12 mins","origin":{"latitude":...,"longitude":...},"destination":{"latitude":...,"longitude":...}}
   </directions>

Retrieved medical context:
${medicalContext}

User coordinates:
Latitude: ${userLocation?.latitude ?? "unknown"}
Longitude: ${userLocation?.longitude ?? "unknown"}

Respond in structured markdown. Keep concise for mobile.`;

    // ─── Tool definitions — use jsonSchema() to avoid Zod 3.25 _def incompatibility ─
    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages: llmMessages,
      stopWhen: stepCountIs(5),
      tools: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getDiseaseInformation: tool({
          description: "Get symptom profiles, WHO advisories, allopathic and homeopathic remedies for a disease",
          parameters: jsonSchema<{ diseaseId: string }>({
            type: "object",
            properties: {
              diseaseId: { type: "string", description: "Disease ID: dengue | malaria | covid | tuberculosis" },
            },
            required: ["diseaseId"],
          }),
          inputSchema: jsonSchema<{ diseaseId: string }>({
            type: "object",
            properties: {
              diseaseId: { type: "string", description: "Disease ID: dengue | malaria | covid | tuberculosis" },
            },
            required: ["diseaseId"],
          }),
          execute: async ({ diseaseId }: { diseaseId: string }) => {
            console.log(`🔧 [Tool] getDiseaseInformation: ${diseaseId}`);
            const data = DISEASES_KNOWLEDGE.find((d) => d.id === diseaseId);
            return data
              ? { success: true, data }
              : { success: false, message: "Disease not found in knowledge base" };
          },
        } as any),

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getNearbyHospitals: tool({
          description: "Locate nearby hospitals and Primary Health Centers (PHCs) specializing in a disease",
          parameters: jsonSchema<{ latitude?: number; longitude?: number; emergencyOnly?: boolean; diseaseId?: string }>({
            type: "object",
            properties: {
              latitude: { type: "number", description: "User latitude" },
              longitude: { type: "number", description: "User longitude" },
              emergencyOnly: { type: "boolean", description: "Filter for 24/7 emergency care only" },
              diseaseId: { type: "string", description: "Filter by specialty: dengue | malaria | tuberculosis | stroke | emergency" },
            },
          }),
          inputSchema: jsonSchema<{ latitude?: number; longitude?: number; emergencyOnly?: boolean; diseaseId?: string }>({
            type: "object",
            properties: {
              latitude: { type: "number", description: "User latitude" },
              longitude: { type: "number", description: "User longitude" },
              emergencyOnly: { type: "boolean", description: "Filter for 24/7 emergency care only" },
              diseaseId: { type: "string", description: "Filter by specialty: dengue | malaria | tuberculosis | stroke | emergency" },
            },
          }),
          execute: async ({ latitude, longitude, emergencyOnly, diseaseId }: { latitude?: number; longitude?: number; emergencyOnly?: boolean; diseaseId?: string }) => {
            const lat = typeof latitude === "number" && !isNaN(latitude) ? latitude : (userLocation?.latitude ?? 18.5204);
            const lng = typeof longitude === "number" && !isNaN(longitude) ? longitude : (userLocation?.longitude ?? 73.8567);
            const activeDiseaseId = diseaseId ?? inferDisease(userQuery);

            console.log(`🔧 [Tool] getNearbyHospitals [${lat}, ${lng}] specialty: ${activeDiseaseId || "none"}`);

            // Try Google Places API if key is available
            const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
            if (mapsKey) {
              try {
                const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": mapsKey,
                    "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.types",
                  },
                  body: JSON.stringify({
                    includedTypes: ["hospital", "doctor"],
                    maxResultCount: 8,
                    locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } },
                  }),
                });
                if (res.ok) {
                  const placesData = await res.json();
                  const liveHospitals = (placesData.places ?? []).map((p: any) => {
                    const pLat = p.location?.latitude ?? lat;
                    const pLng = p.location?.longitude ?? lng;
                    const dist = Math.sqrt(Math.pow(pLat - lat, 2) + Math.pow(pLng - lng, 2)) * 111;
                    return {
                      id: p.id, name: p.displayName?.text ?? "Unknown",
                      address: p.formattedAddress ?? "", phone: p.nationalPhoneNumber ?? "",
                      hasEmergency24_7: p.types?.includes("hospital") ?? false,
                      coordinates: { latitude: pLat, longitude: pLng },
                      specialties: activeDiseaseId ? [activeDiseaseId] : ["general medicine"],
                      distance: parseFloat(dist.toFixed(1)), matchesSpecialty: !!activeDiseaseId,
                    };
                  }).sort((a: any, b: any) => a.distance - b.distance).slice(0, 3);

                  if (liveHospitals.length > 0) {
                    return { success: true, hospitals: liveHospitals, source: "google_places" };
                  }
                }
              } catch (e) {
                console.warn("⚠️ [Tool] Google Places API failed, falling back to mock:", e);
              }
            }

            const scored = scoreHospitals(MOCK_HOSPITALS, lat, lng, activeDiseaseId);
            const filtered = emergencyOnly ? scored.filter((h) => h.hasEmergency24_7) : scored;
            return { success: true, hospitals: filtered.slice(0, 3), source: "mock" };
          },
        } as any),

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getHospitalDirections: tool({
          description: "Get driving directions, ETA, and distance from user location to a specific hospital",
          parameters: jsonSchema<{ originLat: number; originLng: number; destinationLat: number; destinationLng: number; hospitalName?: string }>({
            type: "object",
            properties: {
              originLat: { type: "number", description: "User's' latitude" },
              originLng: { type: "number", description: "User's' longitude" },
              destinationLat: { type: "number", description: "Hospital's' latitude" },
              destinationLng: { type: "number", description: "Hospital's' longitude" },
              hospitalName: { type: "string", description: "Hospital name for display" },
            },
            required: ["originLat", "originLng", "destinationLat", "destinationLng"],
          }),
          inputSchema: jsonSchema<{ originLat: number; originLng: number; destinationLat: number; destinationLng: number; hospitalName?: string }>({
            type: "object",
            properties: {
              originLat: { type: "number", description: "User's' latitude" },
              originLng: { type: "number", description: "User's' longitude" },
              destinationLat: { type: "number", description: "Hospital's' latitude" },
              destinationLng: { type: "number", description: "Hospital's' longitude" },
              hospitalName: { type: "string", description: "Hospital name for display" },
            },
            required: ["originLat", "originLng", "destinationLat", "destinationLng"],
          }),
          execute: async ({ originLat, originLng, destinationLat, destinationLng, hospitalName }: { originLat: number; originLng: number; destinationLat: number; destinationLng: number; hospitalName?: string }) => {
            const lat = typeof originLat === "number" && !isNaN(originLat) ? originLat : (userLocation?.latitude ?? 18.5204);
            const lng = typeof originLng === "number" && !isNaN(originLng) ? originLng : (userLocation?.longitude ?? 73.8567);

            console.log(`🔧 [Tool] getHospitalDirections [${lat},${lng}] → [${destinationLat},${destinationLng}]`);

            const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
            if (mapsKey) {
              try {
                const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${lat},${lng}&destination=${destinationLat},${destinationLng}&mode=driving&key=${mapsKey}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.status === "OK" && data.routes?.length) {
                  const leg = data.routes[0].legs[0];
                  return {
                    success: true, hospitalName: hospitalName ?? "Hospital",
                    distance: leg.distance.text, duration: leg.duration.text,
                    origin: { latitude: lat, longitude: lng },
                    destination: { latitude: destinationLat, longitude: destinationLng },
                  };
                }
              } catch { /* fall through to estimate */ }
            }

            const distKm = Math.sqrt(Math.pow(destinationLat - lat, 2) + Math.pow(destinationLng - lng, 2)) * 111;
            const mins = Math.ceil(distKm * 3);
            return {
              success: true, hospitalName: hospitalName ?? "Hospital",
              distance: `${distKm.toFixed(1)} km`,
              duration: mins < 60 ? `${mins} mins` : `${Math.floor(mins / 60)} hr ${mins % 60} mins`,
              origin: { latitude: lat, longitude: lng },
              destination: { latitude: destinationLat, longitude: destinationLng },
            };
          },
        } as any),

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getOutbreakAlerts: tool({
          description: "Query active public health outbreaks and alerts for an Indian state",
          parameters: jsonSchema<{ state: string }>({
            type: "object",
            properties: {
              state: { type: "string", description: "Indian state name e.g. Maharashtra, Kerala, West Bengal" },
            },
            required: ["state"],
          }),
          inputSchema: jsonSchema<{ state: string }>({
            type: "object",
            properties: {
              state: { type: "string", description: "Indian state name e.g. Maharashtra, Kerala, West Bengal" },
            },
            required: ["state"],
          }),
          execute: async ({ state }: { state: string }) => {
            console.log(`🔧 [Tool] getOutbreakAlerts: ${state}`);
            const alerts = MOCK_OUTBREAKS.filter(
              (o) => o.state.toLowerCase() === state.toLowerCase()
            );
            return { success: true, alerts };
          },
        } as any),
      },
    });

    console.log("🚀 [API Route] Streaming response to client.");
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("❌ [API Route] Critical error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

function inferDisease(query: string): string {
  const q = query.toLowerCase();
  if (q.includes("dengue")) return "dengue";
  if (q.includes("malaria")) return "malaria";
  if (q.includes("tuberculosis") || q.includes(" tb ")) return "tuberculosis";
  return "";
}

// ─── Simulation mode ──────────────────────────────────────────────────────────

function handleSimulatedStream(userQuery: string, userLocation: any, _context: string) {
  const query = userQuery.toLowerCase();
  const isChestPain = query.includes("chest pain") || query.includes("heart attack");
  const isStroke = query.includes("stroke") || query.includes("numbness") || query.includes("slurred");
  const isBreathing = query.includes("breathing") || query.includes("breath") || query.includes("gasp");

  let targetSpecialty = "";
  if (query.includes("dengue")) targetSpecialty = "dengue";
  else if (query.includes("malaria")) targetSpecialty = "malaria";
  else if (isChestPain || isStroke || isBreathing) targetSpecialty = "emergency";
  else if (query.includes("fever") || query.includes("pain")) targetSpecialty = "fever";

  let hospitalsMetadata = "";
  if (targetSpecialty) {
    const lat = userLocation?.latitude ?? 18.5204;
    const lng = userLocation?.longitude ?? 73.8567;
    const matched = scoreHospitals(MOCK_HOSPITALS, lat, lng, targetSpecialty).slice(0, 2);
    hospitalsMetadata = `\n<hospitals>\n${JSON.stringify({ userLocation: { latitude: lat, longitude: lng }, hospitals: matched })}\n</hospitals>\n`;
  }

  let triageMetadata = "";
  let emergencyMetadata = "";
  let responseText = "";

  if (isChestPain || isStroke || isBreathing) {
    let symptom = "Severe Medical Emergency";
    let actions: string[] = [];
    if (isChestPain) {
      symptom = "Severe Chest Pain (Radiating)";
      actions = ["Sit down and remain calm. Avoid all physical activity.", "Chew adult aspirin (325mg) if available and not allergic.", "Call emergency services (108) immediately.", "Do NOT drive yourself to hospital."];
    } else if (isStroke) {
      symptom = "Stroke Symptoms (FAST Alert)";
      actions = ["FAST: Face drooping? Arm weakness? Speech slurred?", "Call 108 immediately.", "Note the exact time symptoms started.", "Do NOT give food, water, or aspirin."];
    } else {
      symptom = "Critical Breathing Distress";
      actions = ["Sit upright, loosen clothing around neck.", "Use rescue inhaler if prescribed.", "Call 108 if gasping or lips turn blue."];
    }
    emergencyMetadata = `\n<emergency>\n${JSON.stringify({ symptom, immediateActions: actions })}\n</emergency>\n`;
    responseText = `### 🚨 EMERGENCY DETECTED: ${symptom}\n\n${actions.map((a, i) => `${i + 1}. **${a}**`).join("\n")}\n\n*Disclaimer: SwasthyaAI is an AI assistant. Call 108 immediately.*`;
  } else if (query.includes("dengue") || query.includes("platelet") || query.includes("bone pain")) {
    triageMetadata = `\n<triage>\n${JSON.stringify({ riskLevel: "high", concerns: ["Dengue Fever Risk"], actions: ["Get CBC and platelet test immediately.", "Rest and hydrate with ORS/coconut water.", "Avoid Aspirin and Ibuprofen.", "Use mosquito nets."], reasoning: "High fever with joint/bone pain is characteristic of Dengue." })}\n</triage>\n`;
    responseText = `### 🩺 Suspected Dengue Fever\n\nRest, hydrate with ORS/coconut water, and take only **Paracetamol** for fever. Get a platelet count test immediately.\n\n*Disclaimer: SwasthyaAI is an AI assistant. Consult a doctor.*`;
  } else if (query.includes("malaria") || query.includes("chill")) {
    triageMetadata = `\n<triage>\n${JSON.stringify({ riskLevel: "medium", concerns: ["Malaria Risk"], actions: ["Get a blood smear or RDT test.", "Take paracetamol for fever.", "Sleep under insecticide-treated bed nets."], reasoning: "Cyclic chills and fever spikes are typical of Malaria." })}\n</triage>\n`;
    responseText = `### 🩺 Suspected Malaria\n\nGet a blood smear or Rapid Diagnostic Test (RDT) done. Antimalarial medications require a prescription.\n\n*Disclaimer: SwasthyaAI is an AI assistant. Consult a doctor.*`;
  } else {
    triageMetadata = `\n<triage>\n${JSON.stringify({ riskLevel: "low", concerns: ["General mild symptoms"], actions: ["Rest and drink warm liquids.", "Monitor temperature.", "Consult a doctor if symptoms persist beyond 3 days."], reasoning: "Symptoms appear mild. Follow standard home care." })}\n</triage>\n`;
    responseText = `### SwasthyaAI Health Guidance\n\nRest and stay hydrated. Monitor your temperature. If symptoms worsen or persist, consult a healthcare professional.\n\n*Disclaimer: SwasthyaAI is an AI assistant.*`;
  }

  const fullPayload = `${triageMetadata}${emergencyMetadata}${hospitalsMetadata}${responseText}`;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of fullPayload.split(" ")) {
        controller.enqueue(encoder.encode(chunk + " "));
        await new Promise((r) => setTimeout(r, 30));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
