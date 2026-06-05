"use client";

import React, { useEffect, useState } from "react";
import { useHealthStore } from "@/store/useHealthStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useHealthStore((state) => state.theme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, mounted]);

  // To prevent hydration warnings and styling flash,
  // we render a clean transition container until client-side state is available.
  if (!mounted) {
    return <div className="invisible">{children}</div>;
  }

  return <>{children}</>;
}
