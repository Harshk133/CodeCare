"use client";

/**
 * useNativeBridge
 * ───────────────
 * Abstracts native-vs-browser differences for features that behave differently
 * inside a Capacitor WebView vs a regular browser.
 *
 * Currently bridges:
 *   • Geolocation — uses @capacitor/geolocation (requests native permission dialog)
 *                   and falls back to the browser Geolocation API on the web.
 *   • isNative    — true when running inside the Capacitor WebView.
 */

import { useState, useCallback } from "react";

export type Coordinates = { latitude: number; longitude: number };

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.protocol === "file:" ||
    !!(window as any).Capacitor?.isNativePlatform?.()
  );
}

// ─── Geolocation ──────────────────────────────────────────────────────────────

async function getNativePosition(): Promise<Coordinates> {
  // Dynamic import so the Capacitor plugin is only bundled when needed and
  // doesn't break the web build.
  const { Geolocation } = await import("@capacitor/geolocation");

  // Request permission — on Android/iOS this shows the native dialog.
  const perm = await Geolocation.requestPermissions();
  if (perm.location === "denied") {
    throw new Error("Location permission denied by user.");
  }

  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10000,
  });

  return {
    latitude:  pos.coords.latitude,
    longitude: pos.coords.longitude,
  };
}

function getBrowserPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export function useNativeGeolocation() {
  const [coords, setCoords]   = useState<Coordinates | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const position = isNativePlatform()
        ? await getNativePosition()
        : await getBrowserPosition();
      setCoords(position);
      return position;
    } catch (err: any) {
      const msg = err.message || "Location unavailable.";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { coords, error, loading, requestLocation };
}

// ─── Microphone / Audio permissions ──────────────────────────────────────────
// On Android the WebView needs RECORD_AUDIO declared in AndroidManifest.xml
// (handled in android/app/src/main/AndroidManifest.xml by our patch script).
// The MediaRecorder API itself works natively inside the Capacitor WebView —
// no extra bridge needed beyond ensuring the manifest permission is present.

export async function requestMicrophonePermission(): Promise<boolean> {
  if (isNativePlatform()) {
    // Capacitor doesn't expose a generic mic-permission API; the system
    // permission dialog fires automatically when getUserMedia is first called.
    // We pre-warm it here so the first call never surprises the user mid-flow.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop()); // stop immediately — just a permission check
      return true;
    } catch {
      return false;
    }
  }
  // On web, permissions are granted when the browser dialog is accepted.
  return true;
}

// ─── Status bar / safe-area helpers ──────────────────────────────────────────

export async function setStatusBarStyle(style: "dark" | "light" = "dark") {
  if (!isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: style === "dark" ? Style.Dark : Style.Light });
  } catch { /* non-fatal */ }
}

export async function hideStatusBar() {
  if (!isNativePlatform()) return;
  try {
    const { StatusBar } = await import("@capacitor/status-bar");
    await StatusBar.hide();
  } catch { /* non-fatal */ }
}
