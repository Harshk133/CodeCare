import { streamText, tool } from "ai";
import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { queryRAG } from "@/services/ragService";
import { DISEASES_KNOWLEDGE, MOCK_OUTBREAKS } from "@/constants/medicalKnowledge";
import { z } from "zod";

// Set runtime to edge/nodejs (standard Next.js 15)
export const maxDuration = 30;

// Mock hospitals database for tools response
const MOCK_HOSPITALS = [
  {
    id: "hosp-1",
    name: "Sanjeevan Specialty Hospital",
    distance: 1.2,
    address: "Deccan Gymkhana, Pune, Maharashtra 411004",
    phone: "+91 20 2567 8000",
    hasEmergency24_7: true,
    coordinates: { latitude: 18.5144, longitude: 73.8412 },
    specialties: ["dengue", "malaria", "fever", "infectious diseases"],
  },
  {
    id: "hosp-2",
    name: "Kamla Nehru Municipal Hospital",
    distance: 2.8,
    address: "Mangalwar Peth, Pune, Maharashtra 411011",
    phone: "+91 20 2447 3012",
    hasEmergency24_7: true,
    coordinates: { latitude: 18.5282, longitude: 73.8631 },
    specialties: ["dengue", "malaria", "tuberculosis", "general medicine"],
  },
  {
    id: "hosp-3",
    name: "Ruby Hall Clinic (Emergency Care)",
    distance: 4.1,
    address: "Sassoon Road, Pune, Maharashtra 411001",
    phone: "+91 20 6645 5100",
    hasEmergency24_7: true,
    coordinates: { latitude: 18.5325, longitude: 73.8788 },
    specialties: ["cardiology", "stroke", "emergency", "intensive care", "breathing distress"],
  },
  {
    id: "hosp-4",
    name: "Primary Health Centre (PHC) Mulshi",
    distance: 15.4,
    address: "Mulshi Road, Maharashtra 411042",
    phone: "+91 20 2292 2011",
    hasEmergency24_7: false,
    coordinates: { latitude: 18.5085, longitude: 73.6195 },
    specialties: ["fever", "malaria", "general medicine", "vaccination"],
  },
  {
    id: "hosp-5",
    name: "Kolkata Medical College Wards",
    distance: 1.8,
    address: "College Street, Kolkata, West Bengal 700073",
    phone: "+91 33 2241 4901",
    hasEmergency24_7: true,
    coordinates: { latitude: 22.5746, longitude: 88.3639 },
    specialties: ["dengue", "malaria", "infectious diseases", "general medicine"],
  },
];

export async function POST(req: Request) {
  console.log("\x1b[35m%s\x1b[0m", "\n📥 [API Route] Received Chat Request...");

  try {
    const { messages, userLocation } = await req.json();
    const latestMessage = messages[messages.length - 1];
    const userQuery = latestMessage.content;

    console.log(`  - Latest message query: "${userQuery}"`);
    if (userLocation) {
      console.log(`  - User coordinates: [Lat: ${userLocation.latitude}, Lng: ${userLocation.longitude}]`);
    }

    // Step 1: Run RAG Search to retrieve context
    const medicalContext = await queryRAG(userQuery);
    console.log("⚡ [API Route] RAG Context retrieval complete.");

    // Sync the Google Gen AI API key to the environment variable name expected by Vercel AI SDK
    if (process.env.NEXT_PUBLIC_GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      console.log("🔑 [API Route] Synced NEXT_PUBLIC_GEMINI_API_KEY to GOOGLE_GENERATIVE_AI_API_KEY");
    }

    const provider = process.env.NEXT_PUBLIC_AI_PROVIDER || "gemini";
    const hasGeminiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !!process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;

    let isSimulationMode = process.env.NEXT_PUBLIC_SIMULATION_MODE === "true";
    let activeProvider = provider;

    // Auto-triage simulation/fallback mode if keys are missing
    if (provider === "openrouter" && !hasOpenRouterKey) {
      console.warn("⚠️ [API Route] OpenRouter selected but OPENROUTER_API_KEY is missing.");
      if (hasGeminiKey) {
        console.log("🔄 [API Route] Falling back to Gemini API.");
        activeProvider = "gemini";
      } else {
        isSimulationMode = true;
      }
    } else if (provider === "gemini" && !hasGeminiKey) {
      console.warn("⚠️ [API Route] Gemini selected but API key is missing.");
      if (hasOpenRouterKey) {
        console.log("🔄 [API Route] Falling back to OpenRouter API.");
        activeProvider = "openrouter";
      } else {
        isSimulationMode = true;
      }
    } else if (!hasGeminiKey && !hasOpenRouterKey) {
      isSimulationMode = true;
    }

    let modelInstance: any;

    if (!isSimulationMode) {
      if (activeProvider === "openrouter") {
        const openrouter = createOpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: process.env.OPENROUTER_API_KEY,
          headers: {
            "HTTP-Referer": "https://swasthya-ai.vercel.app",
            "X-Title": "SwasthyaAI",
          },
        });
        const modelName = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
        console.log(`🤖 [API Route] MODE: Querying OpenRouter model [${modelName}]...`);
        modelInstance = openrouter.chat(modelName);
      } else {
        console.log("🤖 [API Route] MODE: Querying Google Gemini-2.0-Flash model...");
        modelInstance = google("gemini-2.0-flash");
      }
    }

    if (isSimulationMode) {
      console.log("🌐 [API Route] MODE: Running Simulated Stream (API keys missing or simulation active)...");
      return handleSimulatedStream(userQuery, userLocation, medicalContext);
    }

    // Step 2: System prompt detailing safety and disclaimer constraints
    const systemPrompt = `You are SwasthyaAI, a multilingual public health assistant.
Your main goals are raising public disease awareness, providing symptom-based triage guidance, and mapping nearby hospitals.

CRITICAL RULES:
1. Always include a clear medical disclaimer. State that you are an AI assistant and not a medical doctor.
2. NEVER diagnose a patient with certainty. Use terms like "possible concern" or "suggests risk of".
3. NEVER prescribe medications (e.g. never say "Take 10mg of Drug X"). Only suggest common over-the-counter remedies like Paracetamol or ORS (Oral Rehydration Solution) for mild symptom management, and note when to consult a doctor.
4. Detect emergencies immediately! If the user mentions chest pain, numbness, facial drooping, blue lips, severe dyspnea, heavy bleeding, or unconsciousness, trigger an emergency alert.
5. In your response text, you must output structured metadata tags for the UI:
   - For Triage Results, output a <triage> JSON block like:
     <triage>
     {
       "riskLevel": "low" | "medium" | "high" | "emergency",
       "concerns": ["Brief summary of concern"],
       "actions": ["Immediate practical steps for the user"],
       "reasoning": "Explainable AI reasoning details on why this risk level was selected"
     }
     </triage>
   - For emergency triggers, output an <emergency> JSON block like:
     <emergency>
     {
       "symptom": "Chest Pain",
       "immediateActions": ["Action 1", "Action 2"]
     }
     </emergency>
   - For hospital recommendations or searches (especially when calling getNearbyHospitals), you MUST output a <hospitals> JSON block like:
     <hospitals>
     {
       "userLocation": { "latitude": 18.5204, "longitude": 73.8567 },
       "hospitals": [
         {
           "name": "Hospital Name",
           "distance": 1.2,
           "address": "Address details",
           "phone": "Phone number",
           "coordinates": { "latitude": 18.5144, "longitude": 73.8412 },
           "specialties": ["dengue", "malaria"],
           "hasEmergency24_7": true
         }
       ]
     }
     </hospitals>

Here is the retrieved medical context to ground your answer:
${medicalContext}

User coordinates (MUST use these when calling getNearbyHospitals):
Latitude: ${userLocation?.latitude ?? "undefined"}
Longitude: ${userLocation?.longitude ?? "undefined"}

Provide your guidance in a structured, clean markdown format. Keep it concise for mobile displays.`;

    // Step 3: Stream text with Vercel AI SDK
    const result = streamText({
      model: modelInstance,
      system: systemPrompt,
      messages: messages,
      tools: {
        getDiseaseInformation: tool({
          description: "Get detailed symptom profiles, WHO advisories, allopathic and homeopathic remedies for a disease",
          parameters: z.object({
            diseaseId: z.string().describe("ID of the disease (dengue, malaria, covid, tuberculosis)"),
          }),
          execute: async ({ diseaseId }: any): Promise<any> => {
            console.log(`🔧 [API Route Tool] Tool 'getDiseaseInformation' called for: ${diseaseId}`);
            const data = DISEASES_KNOWLEDGE.find((d) => d.id === diseaseId);
            return data ? { success: true, data } : { success: false, message: "Disease not found in database" };
          },
        } as any),
        getNearbyHospitals: tool({
          description: "Locate nearby hospitals and Primary Health Centers (PHCs) specializing in a disease",
          parameters: z.object({
            latitude: z.number().optional().describe("User latitude"),
            longitude: z.number().optional().describe("User longitude"),
            emergencyOnly: z.boolean().optional().describe("Filter for 24/7 emergency care"),
            diseaseId: z.string().optional().describe("Filter/prioritize by disease specialty (e.g. dengue, malaria, tuberculosis, stroke)"),
          }),
          execute: async ({ latitude, longitude, emergencyOnly, diseaseId }: any): Promise<any> => {
            // Fallback safeguards for latitude and longitude
            const lat = (typeof latitude === "number" && !isNaN(latitude)) ? latitude : (userLocation?.latitude || 18.5204);
            const lng = (typeof longitude === "number" && !isNaN(longitude)) ? longitude : (userLocation?.longitude || 73.8567);
            
            // Fallback safeguard for diseaseId based on query if not specified
            const activeDiseaseId = diseaseId || (userQuery.toLowerCase().includes("dengue") ? "dengue" : userQuery.toLowerCase().includes("malaria") ? "malaria" : userQuery.toLowerCase().includes("tuberculosis") ? "tuberculosis" : "");

            console.log(`🔧 [API Route Tool] Tool 'getNearbyHospitals' called at: [${latitude}, ${longitude}] -> Resolved to: [${lat}, ${lng}], specialty: ${activeDiseaseId || "none"}`);
            
            // Calculate distance and check specialty match
            const hospitals = MOCK_HOSPITALS.map((h) => {
              const dist = Math.sqrt(
                Math.pow(h.coordinates.latitude - lat, 2) +
                Math.pow(h.coordinates.longitude - lng, 2)
              ) * 111; // 1 degree lat is ~111km
              
              const matchesSpecialty = activeDiseaseId
                ? h.specialties.some((s) => s.toLowerCase().includes(activeDiseaseId.toLowerCase()))
                : false;

              return { 
                ...h, 
                distance: parseFloat(dist.toFixed(1)), 
                matchesSpecialty 
              };
            });

            const filtered = emergencyOnly ? hospitals.filter((h) => h.hasEmergency24_7) : hospitals;
            
            // Sort matching specialty first, then by closest distance
            filtered.sort((a, b) => {
              if (a.matchesSpecialty && !b.matchesSpecialty) return -1;
              if (!a.matchesSpecialty && b.matchesSpecialty) return 1;
              return a.distance - b.distance;
            });

            return { success: true, hospitals: filtered.slice(0, 3) };
          },
        } as any),
        getOutbreakAlerts: tool({
          description: "Query active public health outbreaks and regional alerts for an Indian state",
          parameters: z.object({
            state: z.string().describe("Name of the Indian state (e.g. Maharashtra, Kerala)"),
          }),
          execute: async ({ state }: any): Promise<any> => {
            console.log(`🔧 [API Route Tool] Tool 'getOutbreakAlerts' called for state: ${state}`);
            const alerts = MOCK_OUTBREAKS.filter(
              (o) => o.state.toLowerCase() === state.toLowerCase()
            );
            return { success: true, alerts };
          },
        } as any),
      },
    });

    console.log("🚀 [API Route] Streaming response back to client.");
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("❌ [API Route] Critical error in chat API route handler:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error occurred processing request." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle custom simulation streams when keys are missing or offline mode is toggled.
 */
function handleSimulatedStream(userQuery: string, userLocation: any, context: string) {
  const query = userQuery.toLowerCase();
  let responseText = "";
  let triageMetadata = "";
  let emergencyMetadata = "";
  let hospitalsMetadata = "";

  // Emergency triggers detection
  const isChestPain = query.includes("chest pain") || query.includes("heart attack") || query.includes("radiating pain");
  const isStroke = query.includes("stroke") || query.includes("numbness") || query.includes("slurred speech") || query.includes("droop");
  const isBreathing = query.includes("breathing") || query.includes("breath") || query.includes("gasp") || query.includes("suffocat") || query.includes("oxygen");

  // Determine specialty target based on user query
  let targetSpecialty = "";
  if (query.includes("dengue")) targetSpecialty = "dengue";
  else if (query.includes("malaria")) targetSpecialty = "malaria";
  else if (isChestPain || isStroke || isBreathing) targetSpecialty = "emergency";
  else if (query.includes("fever") || query.includes("pain")) targetSpecialty = "fever";

  if (targetSpecialty) {
    const lat = userLocation?.latitude || 18.5204;
    const lng = userLocation?.longitude || 73.8567;
    const matched = MOCK_HOSPITALS.map((h) => {
      const dist = Math.sqrt(
        Math.pow(h.coordinates.latitude - lat, 2) +
        Math.pow(h.coordinates.longitude - lng, 2)
      ) * 111;
      const matchesSpecialty = h.specialties.some(s => s.toLowerCase().includes(targetSpecialty.toLowerCase()));
      return {
        name: h.name,
        distance: parseFloat(dist.toFixed(1)),
        address: h.address,
        phone: h.phone,
        coordinates: h.coordinates,
        specialties: h.specialties,
        hasEmergency24_7: h.hasEmergency24_7,
        matchesSpecialty
      };
    }).sort((a, b) => {
      if (a.matchesSpecialty && !b.matchesSpecialty) return -1;
      if (!a.matchesSpecialty && b.matchesSpecialty) return 1;
      return a.distance - b.distance;
    }).slice(0, 2);

    hospitalsMetadata = `
<hospitals>
{
  "userLocation": { "latitude": ${lat}, "longitude": ${lng} },
  "hospitals": ${JSON.stringify(matched)}
}
</hospitals>
`;
  }

  if (isChestPain || isStroke || isBreathing) {
    console.log("🚨 [API Route Simulation] Emergency scenario detected.");
    let symptom = "Severe Medical Emergency";
    let actions: string[] = [];

    if (isChestPain) {
      symptom = "Severe Chest Pain (Radiating)";
      actions = [
        "Sit down and remain completely calm. Avoid physical activity.",
        "Chew an adult aspirin (325mg) if available and not allergic.",
        "Call emergency services (108) immediately.",
        "Do NOT attempt to drive to the hospital yourself.",
      ];
    } else if (isStroke) {
      symptom = "Stroke Symptoms (FAST Alert)";
      actions = [
        "FAST check: Face drooping? Arm weakness? Speech slurred?",
        "Call 108 emergency response immediately.",
        "Note the exact time symptoms started.",
        "Do NOT give any food, water, or aspirin.",
      ];
    } else {
      symptom = "Critical Breathing Distress";
      actions = [
        "Sit upright and loosen tight clothing around your neck.",
        "Use a rescue inhaler (e.g. salbutamol) if prescribed.",
        "Call 108 immediately if gasping or lips turn blue.",
      ];
    }

    emergencyMetadata = `
<emergency>
{
  "symptom": "${symptom}",
  "immediateActions": ${JSON.stringify(actions)}
}
</emergency>
`;

    responseText = `### 🚨 CRITICAL HEALTH ALERT: EMERGENCY DETECTED

Our symptom scanner has detected signs suggestive of a **${symptom}**. This requires immediate medical intervention.

**Immediate First-Aid Protocols:**
${actions.map((a, i) => `${i + 1}. **${a}**`).join("\n")}

---
🏥 **Nearest Emergency Facility Recommended:**
- **Ruby Hall Clinic (Emergency Care)** - ~4.1 km away
  *Address:* Sassoon Road, Pune.
  *Emergency Hotline:* \`+91 20 6645 5100\`

*Disclaimer: SwasthyaAI is an AI-grounded educational assistant. This alert does NOT replace professional medical diagnoses. Call 108 immediately.*
`;
  } else if (query.includes("dengue") || query.includes("platelet") || query.includes("bone pain")) {
    console.log("🦟 [API Route Simulation] Dengue scenario matched.");
    triageMetadata = `
<triage>
{
  "riskLevel": "high",
  "concerns": ["Dengue Fever Risk due to symptoms matching joint/muscle pain and high fever"],
  "actions": [
    "Schedule a complete blood count (CBC) and platelet test immediately.",
    "Rest completely and maintain high fluid intake (ORS, coconut water).",
    "Avoid Aspirin, Ibuprofen, or Naproxen as they increase bleeding risks.",
    "Use mosquito nets and clear stagnant water in your vicinity."
  ],
  "reasoning": "High fever combined with severe joint/bone pain ('break-bone') is highly characteristic of Dengue. Platelet levels must be checked to prevent Dengue Hemorrhagic Fever."
}
</triage>
`;

    responseText = `### 🩺 Symptom Triage: Suspected Dengue Fever

Based on your symptoms and WHO guidelines, you may be experiencing a risk of **Dengue Fever**.

#### 📋 Key Medical Guidance:
1. **Fluid Intake:** Drink plenty of fluids (Oral Rehydration Solution, coconut water, or fresh juices) to stay hydrated.
2. **Fever Management:** Use only **Paracetamol** (Acetaminophen) for fever. **Do NOT take Ibuprofen, Aspirin, or Diclofenac** as they can thin your blood and cause dangerous bleeding.
3. **Platelet Monitoring:** Go to a lab for a platelet and hematocrit check. Monitor this daily if fever continues.

#### 🌿 Homeopathic Support (Adjunct):
* **Eupatorium Perfoliatum:** Highly indicated for the 'break-bone' joint and muscle pains.
* **Carica Papaya Q (Mother Tincture):** Traditionally used in Indian homeopathy to support platelet production.

*Disclaimer: SwasthyaAI is an educational public health assistant. Always consult a certified medical practitioner.*
`;
  } else if (query.includes("malaria") || query.includes("chill") || query.includes("shak")) {
    console.log("🦟 [API Route Simulation] Malaria scenario matched.");
    triageMetadata = `
<triage>
{
  "riskLevel": "medium",
  "concerns": ["Malaria Risk based on chills and cyclic fever spikes"],
  "actions": [
    "Get a blood smear or rapid diagnostic test (RDT) for Malaria.",
    "Take paracetamol for fever and stay hydrated.",
    "Sleep under insecticide-treated bed nets to prevent spreading the infection."
  ],
  "reasoning": "Cyclic shaking chills followed by high fever spikes are typical signs of Malaria. Early blood test diagnosis is vital to target the correct parasite strain."
}
</triage>
`;

    responseText = `### 🩺 Symptom Triage: Suspected Malaria

Your symptoms suggest a possible concern for **Malaria**, a mosquito-borne parasite infection.

#### 📋 Key Medical Guidance:
1. **Diagnostic Testing:** It is essential to get a blood slide test or Rapid Diagnostic Test (RDT) done at a clinic. Malaria cannot be cured without specific antimalarial medications.
2. **Allopathic Treatment:** Once confirmed, doctors typically prescribe ACTs (Artemisinin-based Combination Therapies).
3. **Homeopathic Support (Adjunct):**
   - **China Officinalis:** Indicated for severe debility, dehydration, and exhaustion following sweating spells.
   - **Arsenicum Album:** Suited for periodic fevers with high anxiety, restlessness, and chilliness.

*Disclaimer: SwasthyaAI is an educational public health assistant. Antimalarial drugs require a prescription from a doctor.*
`;
  } else {
    // General response fallback
    console.log("📝 [API Route Simulation] General query matched.");
    triageMetadata = `
<triage>
{
  "riskLevel": "low",
  "concerns": ["General fever/mild symptoms"],
  "actions": [
    "Rest and drink warm liquids.",
    "Monitor temperature with a thermometer.",
    "Consult a doctor if symptoms persist beyond 3 days."
  ],
  "reasoning": "Symptoms appear mild. Follow standard home care and monitor for any warning signs."
}
</triage>
`;

    responseText = `### SwasthyaAI General Health Guidance

Thank you for reaching out. Based on your query, we recommend standard supportive care:

- **Hydration:** Rest and drink plenty of water, herbal teas, or broths.
- **Monitoring:** Keep a record of your temperature.
- **Safety warning:** If you develop severe pain, breathing difficulty, or chest discomfort, visit a clinic immediately.

*Disclaimer: SwasthyaAI is an AI-powered assistant for health awareness. It does not replace medical advice.*
`;
  }

  // Combine content stream
  const fullPayload = `${triageMetadata}${emergencyMetadata}${hospitalsMetadata}${responseText}`;

  // Stream text response with standard ReadableStream
  const encoder = new TextEncoder();
  const customStream = new ReadableStream({
    async start(controller) {
      // Stream text chunk by chunk to simulate AI response
      const chunks = fullPayload.split(" ");
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk + " "));
        // Wait ~30ms per word
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      controller.close();
    },
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
