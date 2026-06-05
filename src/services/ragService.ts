import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenAI } from "@google/genai";
import { DISEASES_KNOWLEDGE } from "@/constants/medicalKnowledge";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "swasthya-health-index";

export async function queryRAG(queryText: string): Promise<string> {
  console.log(`\n🔍 [RAG Service] Processing query: "${queryText}"`);

  // Check if we should use Pinecone RAG or local fallback search
  const canUsePinecone =
    process.env.NEXT_PUBLIC_SIMULATION_MODE !== "true" &&
    !!PINECONE_API_KEY &&
    !!GEMINI_API_KEY;

  if (canUsePinecone) {
    console.log("⚡ [RAG Service] Mode: Pinecone Vector Database Search");
    try {
      // Step 1: Connect to Pinecone
      console.log("  1. Connecting to Pinecone...");
      const pc = new Pinecone({ apiKey: PINECONE_API_KEY as string });
      const index = pc.Index(PINECONE_INDEX);

      // Step 2: Initialize Gemini Client for Query Embedding
      console.log("  2. Initializing Gemini Client for Query Embedding...");
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY as string });

      // Step 3: Embed user query
      console.log("  3. Generating embedding vector for user query...");
      const embeddingResponse = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: queryText,
      });
      const embedRes = embeddingResponse as any;
      let vectorValues: number[] | undefined = undefined;
      if (embedRes.embedding && Array.isArray(embedRes.embedding.values)) {
        vectorValues = embedRes.embedding.values;
      } else if (Array.isArray(embedRes.embeddings) && embedRes.embeddings[0] && Array.isArray(embedRes.embeddings[0].values)) {
        vectorValues = embedRes.embeddings[0].values;
      } else if (embedRes.embeddings && Array.isArray(embedRes.embeddings.values)) {
        vectorValues = embedRes.embeddings.values;
      }

      if (!vectorValues || vectorValues.length === 0) {
        console.warn("  ⚠️ Warning: Failed to generate query embedding values. Falling back to local search.");
        return queryLocalKnowledge(queryText);
      }

      // Step 4: Query Pinecone index
      console.log("  4. Querying Pinecone Vector Store...");
      const queryResponse = await index.query({
        vector: vectorValues,
        topK: 3,
        includeMetadata: true,
      });

      console.log(`  5. Retrieved ${queryResponse.matches?.length || 0} matches from Pinecone.`);

      if (queryResponse.matches && queryResponse.matches.length > 0) {
        const contextDocs = queryResponse.matches
          .map((match) => {
            const metadata = match.metadata as any;
            console.log(`    - Match ID: ${match.id} (Score: ${(match.score || 0).toFixed(4)})`);
            return metadata?.text || "";
          })
          .filter(Boolean)
          .join("\n\n---\n\n");

        return contextDocs;
      } else {
        console.log("  ⚠️ No matching vectors found. Falling back to local search.");
        return queryLocalKnowledge(queryText);
      }
    } catch (error) {
      console.error("❌ [RAG Service] Error querying Pinecone database:", error);
      console.log("🔄 [RAG Service] Falling back to local keyword search engine...");
      return queryLocalKnowledge(queryText);
    }
  } else {
    console.log("🌐 [RAG Service] Mode: Local In-Memory Knowledge Base Search");
    return queryLocalKnowledge(queryText);
  }
}

/**
 * Perform a high-fidelity keyword and semantic match on our in-memory medical knowledge base.
 */
function queryLocalKnowledge(queryText: string): string {
  console.log("  1. Initializing local keyword scans...");
  const lowerQuery = queryText.toLowerCase();
  const matchedDocs: string[] = [];

  // Track matched disease entities
  const matches: { diseaseId: string; score: number }[] = [];

  for (const disease of DISEASES_KNOWLEDGE) {
    let score = 0;

    // Direct name match
    if (lowerQuery.includes(disease.name.toLowerCase()) || lowerQuery.includes(disease.id)) {
      score += 10;
      console.log(`    - Direct match found for: ${disease.name}`);
    }

    // Category match
    if (lowerQuery.includes(disease.category)) {
      score += 2;
    }

    // Symptom keyword match
    for (const symptom of disease.symptoms) {
      const parts = symptom.toLowerCase().split(/[ ,()]+/);
      for (const part of parts) {
        if (part.length > 3 && lowerQuery.includes(part)) {
          score += 1.5;
        }
      }
    }

    // Warning triggers match
    for (const trigger of disease.emergencyTriggers) {
      if (lowerQuery.includes(trigger.toLowerCase())) {
        score += 3;
      }
    }

    if (score > 0) {
      matches.push({ diseaseId: disease.id, score });
    }
  }

  // Sort matches by relevance score
  matches.sort((a, b) => b.score - a.score);

  console.log(`  2. Local search results: found ${matches.length} matched diseases.`);

  // If we found matches, fetch their corresponding detail chunks
  if (matches.length > 0) {
    const topMatches = matches.slice(0, 2); // Get top 2 matched diseases
    for (const match of topMatches) {
      const disease = DISEASES_KNOWLEDGE.find((d) => d.id === match.diseaseId);
      if (disease) {
        console.log(`    - Retrieve context for: ${disease.name} (Score: ${match.score})`);

        const docContent = `Disease: ${disease.name}
Category: ${disease.category}
Symptoms: ${disease.symptoms.join(", ")}
WHO Guidelines: ${disease.whoGuidelines.join("\n")}
Allopathic Management: ${disease.allopathyTreatment.description}
Allopathic Management Checklist: ${disease.allopathyTreatment.management.join("\n")}
Allopathic Medications: ${disease.allopathyTreatment.medications.join("\n")}
Allopathic Warning Signs: ${disease.allopathyTreatment.warnings.join("\n")}
Homeopathic Management: ${disease.homeopathyTreatment.description}
Homeopathic Remedies:
${disease.homeopathyTreatment.remedies.map((r) => `- ${r.name}: ${r.indication}`).join("\n")}
Homeopathic Warnings: ${disease.homeopathyTreatment.warnings.join("\n")}
Prevention protocols: ${disease.prevention.join("\n")}`;

        matchedDocs.push(docContent);
      }
    }
  }

  // If no specific diseases matched, return general first-aid guidance context
  if (matchedDocs.length === 0) {
    console.log("  ⚠️ No matching disease found. Returning general medical guidance context.");
    return `General Medical Advice:
1. For high fevers, rest, hydration, and Paracetamol are indicated.
2. Watch out for warning signs such as chest pain, breathing difficulty, severe bleeding, or unconsciousness.
3. Consult a medical professional for proper diagnosis. SwasthyaAI does not prescribe drugs.`;
  }

  return matchedDocs.join("\n\n---\n\n");
}
