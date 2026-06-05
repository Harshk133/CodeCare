import { Metadata } from "next";
import ChatClient from "./ChatClient";

export const metadata: Metadata = {
  title: "Consult SwasthyaAI - Public Health Assistant",
  description: "Multilingual symptom triage, disease awareness, and hospital finder chatbot.",
};

export default function ChatPage() {
  return <ChatClient />;
}
