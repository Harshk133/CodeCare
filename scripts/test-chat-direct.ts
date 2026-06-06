import dotenv from "dotenv";
import path from "path";

// Load env variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Import the POST handler directly
import { POST } from "../src/app/api/chat/route";

async function testDirect() {
  console.log("Starting test-chat-direct script...");
  console.log("OPENROUTER_API_KEY present:", !!process.env.OPENROUTER_API_KEY);
  console.log("NEXT_PUBLIC_AI_PROVIDER:", process.env.NEXT_PUBLIC_AI_PROVIDER);

  const payload = {
    messages: [
      { role: "user", content: "अगर मुझे बुखार है तो मैं क्या करूँ?" }
    ],
    language: "hi"
  };

  // Construct a mock Request object
  const req = new Request("http://localhost:3001/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  try {
    const res = await POST(req);
    console.log("Direct handler response status:", res.status);

    if (res.status !== 200) {
      const text = await res.text();
      console.error("Direct handler returned error body:", text);
      return;
    }

    if (!res.body) {
      console.log("Direct handler returned empty body.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let text = "";

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        text += chunk;
        process.stdout.write(chunk);
      }
    }

    console.log("\n\nDirect Stream complete. Total chars:", text.length);
  } catch (err: any) {
    console.error("Direct handler failed with error:", err);
    if (err.stack) {
      console.error(err.stack);
    }
  }
}

testDirect();
