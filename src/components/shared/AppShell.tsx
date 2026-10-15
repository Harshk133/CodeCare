"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHealthStore } from "@/store/useHealthStore";
import { LanguageCode } from "@/types";
import {
  Home,
  MessageCircle,
  MapPin,
  Radio,
  BookOpen,
  Sun,
  Moon,
  Phone,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface AppShellProps {
  children: React.ReactNode;
  /**
   * "page" — scrolling document with a footer (landing, content pages).
   * "app"  — fills exactly one viewport; the child manages its own scrolling (chat).
   */
  variant?: "page" | "app";
}

export const LANGUAGES: { code: LanguageCode; name: string }[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "mr", name: "मराठी" },
  { code: "ta", name: "தமிழ்" },
  { code: "te", name: "తెలుగు" },
  { code: "bn", name: "বাংলা" },
  { code: "gu", name: "ગુજરાતી" },
];

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="15" className="fill-accent" />
      <path
        d="M13 8.5h6v4.5h4.5v6H19v4.5h-6V19H8.5v-6H13z"
        className="fill-primary dark:fill-[hsl(var(--background))]"
      />
    </svg>
  );
}

export function AppShell({ children, variant = "page" }: AppShellProps) {
  const pathname = usePathname();
  const { language, setLanguage, theme, toggleTheme } = useHealthStore();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const navItems = [
    { label: t("nav_home"), href: "/", icon: Home },
    { label: t("nav_chat"), href: "/chat", icon: MessageCircle },
    { label: t("nav_hospitals"), href: "/hospitals", icon: MapPin },
    { label: t("nav_alerts"), href: "/alerts", icon: Radio },
    { label: t("nav_awareness"), href: "/awareness", icon: BookOpen },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  if (!mounted) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  const isApp = variant === "app";

  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        isApp ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
      )}
    >
      {/* Emergency line — always one tap away */}
      <a
        href="tel:108"
        className="group flex items-center justify-center gap-2 bg-destructive px-4 py-1.5 text-[13px] leading-tight text-destructive-foreground"
      >
        <span className="hidden sm:inline">{t("emergency_strip")}</span>
        <span className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 group-hover:underline">
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          {t("emergency_call")}
        </span>
      </a>

      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 rounded-md">
            <Logo className="h-7 w-7" />
            <span className="font-heading text-[1.35rem] font-bold leading-none tracking-tight text-primary">
              SwasthyaAI
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {navItems.slice(1).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-3 py-2 text-[15px] font-medium transition-colors",
                  isActive(item.href)
                    ? "text-foreground after:absolute after:inset-x-3 after:-bottom-[9px] after:h-[3px] after:rounded-full after:bg-accent"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <label className="relative flex h-9 items-center gap-1.5 rounded-md border bg-card pl-2.5 pr-2 text-sm">
              <Languages className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="cursor-pointer bg-transparent pr-1 font-medium text-foreground outline-none"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-card text-foreground">
                    {lang.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:text-foreground"
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className={cn("flex-1", isApp && "min-h-0")}>
        {isApp ? children : <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:pt-12">{children}</div>}
      </main>

      {!isApp && (
        <footer className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm leading-relaxed text-muted-foreground">
            <p className="max-w-[70ch]">{t("disclaimer").replace(/^⚠️\s*/, "")}</p>
          </div>
        </footer>
      )}

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main"
        className={cn(
          "z-40 grid grid-cols-5 border-t bg-background md:hidden",
          isApp ? "" : "sticky bottom-0"
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] leading-none",
                active ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-accent" />}
              <Icon className={cn("h-5 w-5", active && "text-primary")} aria-hidden="true" />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
