import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LanguageCode, Coordinates, Message, OutbreakAlert } from "@/types";

interface HealthState {
  language: LanguageCode;
  userLocation: Coordinates | null;
  messages: Message[];
  activeAlerts: OutbreakAlert[];
  theme: "light" | "dark";
  setLanguage: (lang: LanguageCode) => void;
  setUserLocation: (loc: Coordinates | null) => void;
  addMessage: (msg: Message) => void;
  clearChat: () => void;
  setActiveAlerts: (alerts: OutbreakAlert[]) => void;
  toggleTheme: () => void;
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set) => ({
      language: "en",
      userLocation: null,
      messages: [],
      activeAlerts: [],
      theme: "light",
      setLanguage: (language) => set({ language }),
      setUserLocation: (userLocation) => set({ userLocation }),
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      clearChat: () => set({ messages: [] }),
      setActiveAlerts: (activeAlerts) => set({ activeAlerts }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "light" ? "dark" : "light",
        })),
    }),
    {
      name: "swasthya-ai-store",
      // Only persist configuration fields and history
      partialize: (state) => ({
        language: state.language,
        userLocation: state.userLocation,
        messages: state.messages,
        theme: state.theme,
      }),
    }
  )
);
