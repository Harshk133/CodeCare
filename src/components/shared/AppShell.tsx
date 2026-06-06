"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHealthStore } from "@/store/useHealthStore";
import { LanguageCode } from "@/types";
import {
  Home,
  MessageSquare,
  MapPin,
  AlertTriangle,
  BookOpen,
  Globe,
  Sun,
  Moon,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface AppShellProps {
  children: React.ReactNode;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "mr", name: "मराठी" },
  { code: "ta", name: "தமிழ்" },
  { code: "te", name: "తెలుగు" },
  { code: "bn", name: "বাংলা" },
  { code: "gu", name: "ગુજરાતી" },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { language, setLanguage, theme, toggleTheme } = useHealthStore();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { label: t("nav_home"), href: "/", icon: Home },
    { label: t("nav_chat"), href: "/chat", icon: MessageSquare },
    { label: t("nav_hospitals"), href: "/hospitals", icon: MapPin },
    { label: t("nav_alerts"), href: "/alerts", icon: AlertTriangle },
    { label: t("nav_awareness"), href: "/awareness", icon: BookOpen },
  ];

  if (!mounted) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/20">
              <ShieldAlert className="h-5.5 w-5.5 animate-pulse" />
            </div>
            <div>
              <span className="font-heading text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                SwasthyaAI
              </span>
              <span className="hidden sm:inline-block ml-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Public Health Assistant
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Configuration Actions */}
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 glass text-xs font-semibold">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="bg-transparent outline-none cursor-pointer text-foreground font-medium"
              >
                {LANGUAGES.map((lang) => (
                  <option
                    key={lang.code}
                    value={lang.code}
                    className="text-foreground bg-background"
                  >
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg border glass hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-primary" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-20 md:pb-6">
        <div className="container mx-auto px-4 py-6">{children}</div>
      </main>

      {/* Global Medical Disclaimer Banner */}
      <div className="fixed bottom-16 left-0 right-0 z-30 md:bottom-0 border-t bg-amber-500/10 dark:bg-amber-500/5 backdrop-blur-md px-4 py-2 text-center text-[11px] text-amber-600 dark:text-amber-500 font-medium">
        {t("disclaimer")}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur-md md:hidden px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-14 h-12 rounded-lg transition-all",
                isActive
                  ? "text-primary scale-105 font-bold"
                  : "text-muted-foreground active:scale-95"
              )}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
