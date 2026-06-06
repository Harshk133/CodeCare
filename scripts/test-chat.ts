import dotenv from "dotenv";
import path from "path";

// Load env variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function testChat() {
  console.log("Starting test-chat script...");
  console.log("OPENROUTER_API_KEY present:", !!process.env.OPENROUTER_API_KEY);
  console.log("NEXT_PUBLIC_AI_PROVIDER:", process.env.NEXT_PUBLIC_AI_PROVIDER);
  console.log("OPENROUTER_MODEL:", process.env.OPENROUTER_MODEL);

  const payload = {
    messages: [
      { role: "user", content: "अगर मुझे बुखार है तो मैं क्या करूँ?" }
    ],
    language: "hi"
  };

  try {
    const res = await fetch("http://localhost:3001/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log("Response status:", res.status);
    console.log("Response headers:", Object.fromEntries(res.headers.entries()));

    if (!res.body) {
      console.log("No response body.");
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

    console.log("\n\nStream complete. Total chars:", text.length);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testChat();
