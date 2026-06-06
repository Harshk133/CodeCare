import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.swasthyaai.app",
  appName: "SwasthyaAI",
  webDir: "out",

  server: {
    // HTTPS scheme on Android prevents mixed-content errors when calling external APIs
    androidScheme: "https",
    // Allow the WebView to navigate to / fetch from these external domains
    allowNavigation: [
      "api.hume.ai",
      "openrouter.ai",
      "swasthya-ai.vercel.app",
      "maps.googleapis.com",
      "places.googleapis.com",
    ],
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0d9488",   // teal-600 — matches app primary
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d9488",
    },
    Geolocation: {
      // Capacitor will request location permissions automatically on Android/iOS
    },
  },

  android: {
    // Allow mixed-content (HTTPS page → external HTTPS APIs) — required for Hume/OpenRouter
    allowMixedContent: true,
    // Enable remote debugging via chrome://inspect
    webContentsDebuggingEnabled: true,
    // Minimum SDK — API 24 = Android 7.0 (covers 99 %+ of active devices)
    minWebViewVersion: 60,
  },

  ios: {
    scrollEnabled: true,
    contentInset: "automatic",
  },
};

export default config;
