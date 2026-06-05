// SwasthyaAI Pinecone Database Seeder
// Run this script to seed your Pinecone Vector DB with WHO and Allopathy/Homeopathy guidelines.
// Usage: npx jiti scripts/seed-db.ts

import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenAI } from "@google/genai";
import { DISEASES_KNOWLEDGE } from "../src/constants/medicalKnowledge";
import * as dotenv from "dotenv";

// Load local environment variables
dotenv.config({ path: ".env.local" });

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "swasthya-health-index";

async function seed() {
  console.log("\x1b[36m%s\x1b[0m", "==================================================");
  console.log("\x1b[36m%s\x1b[0m", "🏥 SWASTHYAAI RAG DATABASE SEEDING ENGINE 🏥");
  console.log("\x1b[36m%s\x1b[0m", "==================================================");

  // Step 1: Validate Environment Keys
  console.log("Step 1: Validating environment credentials...");
  if (!GEMINI_API_KEY) {
    console.error(
      "❌ Error: NEXT_PUBLIC_GEMINI_API_KEY is missing in your .env.local file."
    );
    process.exit(1);
  }
  if (!PINECONE_API_KEY) {
    console.error(
      "❌ Error: PINECONE_API_KEY is missing in your .env.local file."
    );
    console.log(
      "💡 Tip: If you just want to run in Simulation Mode without Pinecone, you do not need to run this seeder script."
    );
    process.exit(1);
  }
  console.log("✅ Credentials check passed.");

  // Step 2: Initialize Google Gen AI client
  console.log("\nStep 2: Initializing Gemini Embedding Client...");
  let ai: GoogleGenAI;
  try {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log("✅ Gemini Client successfully initialized.");
  } catch (error) {
    console.error("❌ Failed to initialize Google Gen AI client:", error);
    process.exit(1);
  }

  // Step 3: Initialize Pinecone Client
  console.log("\nStep 3: Connecting to Pinecone Database...");
  let pc: Pinecone;
  try {
    pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    console.log("✅ Connected to Pinecone API.");
  } catch (error) {
    console.error("❌ Failed to connect to Pinecone:", error);
    process.exit(1);
  }

  console.log(`\nStep 4: Verifying Vector Index [${PINECONE_INDEX}]...`);
  try {
    const indexesList = await pc.listIndexes();
    const existingInfo = indexesList.indexes?.find((idx) => idx.name === PINECONE_INDEX);
    let indexExists = false;
    let needsDeletion = false;

    if (existingInfo) {
      indexExists = true;
      if (existingInfo.dimension !== 3072) {
        console.log(`⚠️ Dimension mismatch: Index has ${existingInfo.dimension} dimensions, but model outputs 3072. Deleting index...`);
        needsDeletion = true;
      }
    }

    if (needsDeletion) {
      await pc.deleteIndex(PINECONE_INDEX);
      console.log("⌛ Waiting 8 seconds for index deletion to complete...");
      await new Promise((resolve) => setTimeout(resolve, 8000));
      indexExists = false;
    }

    if (!indexExists) {
      console.log(`🚀 Creating a new index [${PINECONE_INDEX}] with 3072 dimensions...`);
      await pc.createIndex({
        name: PINECONE_INDEX,
        dimension: 3072,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
      console.log("⌛ Index creation requested. Waiting 10 seconds for initialization...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      console.log("✅ Index created successfully.");
    } else {
      console.log(`✅ Index [${PINECONE_INDEX}] is active and ready (dimension: 3072).`);
    }
  } catch (error) {
    console.error("❌ Error during index check/creation:", error);
    process.exit(1);
  }

  // Step 5: Preparing Medical Data Chunks
  console.log("\nStep 5: Chunking medical data for embedding...");
  const vectors: any[] = [];
  const index = pc.Index(PINECONE_INDEX);

  for (const disease of DISEASES_KNOWLEDGE) {
    console.log(`👉 Processing [${disease.name}]...`);

    // Chunk 1: Symptoms and general guidelines
    const textChunk1 = `Disease: ${disease.name}
Category: ${disease.category}
Symptoms: ${disease.symptoms.join(", ")}
WHO Guidelines: ${disease.whoGuidelines.join("\n")}`;

    // Chunk 2: Allopathic Treatments
    const textChunk2 = `Disease: ${disease.name}
Allopathic Management: ${disease.allopathyTreatment.description}
Symptom Relief: ${disease.allopathyTreatment.management.join("\n")}
Medications: ${disease.allopathyTreatment.medications.join("\n")}
Warning signs: ${disease.allopathyTreatment.warnings.join("\n")}`;

    // Chunk 3: Homeopathic Treatments
    const remediesString = disease.homeopathyTreatment.remedies
      .map((r) => `${r.name}: ${r.indication}`)
      .join("\n");
    const textChunk3 = `Disease: ${disease.name}
Homeopathic Management: ${disease.homeopathyTreatment.description}
Remedies and Indications:
${remediesString}
Homeopathic Warnings: ${disease.homeopathyTreatment.warnings.join("\n")}`;

    const chunks = [
      { id: `${disease.id}-general`, text: textChunk1, type: "general" },
      { id: `${disease.id}-allopathy`, text: textChunk2, type: "allopathy" },
      { id: `${disease.id}-homeopathy`, text: textChunk3, type: "homeopathy" },
    ];

    // Generate embeddings for each chunk
    for (const chunk of chunks) {
      console.log(`  └─ Embedding chunk: ${chunk.id}...`);
      try {
        const response = await ai.models.embedContent({
          model: "gemini-embedding-001", // Globally supported text embedding model
          contents: chunk.text,
        });

        // Throttle requests to avoid Google Gen AI rate limits (429)
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const res = response as any;
        console.log("    └─ Response Keys:", Object.keys(res));
        if (res.embedding) {
          console.log("    └─ res.embedding Keys:", Object.keys(res.embedding));
        }

        let vectorValues: number[] | undefined = undefined;
        if (res.embedding && Array.isArray(res.embedding.values)) {
          vectorValues = res.embedding.values;
        } else if (Array.isArray(res.embeddings) && res.embeddings[0] && Array.isArray(res.embeddings[0].values)) {
          vectorValues = res.embeddings[0].values;
        } else if (res.embeddings && Array.isArray(res.embeddings.values)) {
          vectorValues = res.embeddings.values;
        }

        if (vectorValues && vectorValues.length > 0) {
          console.log(`    └─ Success! Vector size: ${vectorValues.length}`);
          vectors.push({
            id: chunk.id,
            values: vectorValues,
            metadata: {
              disease: disease.id,
              diseaseName: disease.name,
              type: chunk.type,
              text: chunk.text,
            },
          });
        } else {
          console.error(`  ❌ Failed to get embedding values for chunk ${chunk.id}`);
        }
      } catch (err) {
        console.error(`  ❌ Error embedding chunk ${chunk.id}:`, err);
      }
    }
  }

  // Step 6: Upserting Vectors to Pinecone
  console.log(`\nStep 6: Upserting ${vectors.length} vectors to Pinecone Index...`);
  try {
    // Pinecone allows batch upserting
    await index.upsert({ records: vectors });
    console.log("🎉 SUCCESS! Pinecone vector store has been seeded successfully.");
    console.log("\x1b[32m%s\x1b[0m", "==================================================");
    console.log("\x1b[32m%s\x1b[0m", "   SWASTHYAAI MEDICAL RAG SEEDING IS COMPLETE!   ");
    console.log("\x1b[32m%s\x1b[0m", "==================================================");
  } catch (error) {
    console.error("❌ Failed to upsert vectors to Pinecone:", error);
    process.exit(1);
  }
}

seed().catch((err) => {
  console.error("❌ Critical execution failure in seeder script:", err);
});
