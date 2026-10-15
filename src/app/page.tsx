"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { SeverityMark } from "@/components/shared/SeverityMark";
import { useTranslation } from "@/hooks/useTranslation";
import { useHealthStore } from "@/store/useHealthStore";
import { MOCK_OUTBREAKS, EMERGENCY_PROTOCOLS } from "@/constants/medicalKnowledge";
import { LanguageCode } from "@/types";
import { cn } from "@/lib/utils";
import { MapPin, Radio, BookOpen, ArrowUp, Phone } from "lucide-react";

// The word for "fever" in every supported language — the most common reason
// people open a health assistant, and a live demonstration of what we speak.
const FEVER: { code: LanguageCode; word: string; lang: string }[] = [
  { code: "hi", word: "बुखार", lang: "हिन्दी" },
  { code: "mr", word: "ताप", lang: "मराठी" },
  { code: "ta", word: "காய்ச்சல்", lang: "தமிழ்" },
  { code: "te", word: "జ్వరం", lang: "తెలుగు" },
  { code: "bn", word: "জ্বর", lang: "বাংলা" },
  { code: "gu", word: "તાવ", lang: "ગુજરાતી" },
  { code: "en", word: "Fever", lang: "English" },
];

const EMERGENCY_SIGNS: Record<string, string> = {
  "chest-pain": "Chest pain or pressure, pain spreading to the arm or jaw",
  stroke: "Face drooping, arm weakness or slurred speech",
  breathing: "Gasping, severe breathlessness or blue lips",
};

export default function HomePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, setLanguage } = useHealthStore();
  const [query, setQuery] = useState("");

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  };

  const destinations = [
    { title: "qa_hospitals_title", desc: "qa_hospitals_desc", cta: "qa_hospitals_btn", href: "/hospitals", icon: MapPin },
    { title: "qa_alerts_title", desc: "qa_alerts_desc", cta: "qa_alerts_btn", href: "/alerts", icon: Radio },
    { title: "qa_awareness_title", desc: "qa_awareness_desc", cta: "qa_awareness_btn", href: "/awareness", icon: BookOpen },
  ];

  const recentOutbreaks = [...MOCK_OUTBREAKS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <AppShell>
      {/* Hero: ask first, in your own language */}
      <section className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div className="flex flex-col justify-center">
          <h1 className="max-w-[18ch] text-[2.5rem] font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.75rem]">
            {t("hero_title")}
          </h1>
          <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted-foreground">
            {t("hero_sub")}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(query);
            }}
            className="mt-8 flex items-center gap-2 rounded-xl border-2 border-primary/25 bg-card p-2 shadow-[0_1px_0_hsl(var(--border)),0_12px_32px_-16px_hsl(var(--primary)/0.35)] focus-within:border-primary"
          >
            <label htmlFor="hero-query" className="sr-only">
              {t("chat_empty_title")}
            </label>
            <input
              id="hero-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("hero_placeholder")}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted-foreground/80"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
            >
              <span className="hidden sm:inline">{t("hero_ask")}</span>
              <ArrowUp className="h-5 w-5 sm:hidden" aria-label={t("hero_ask")} />
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {["hero_ex_1", "hero_ex_2", "hero_ex_3"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => ask(t(key))}
                className="rounded-full border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>

        {/* Language specimen — doubles as the language picker */}
        <figure className="lg:border-l lg:pl-12">
          <ul className="divide-y">
            {FEVER.map((f) => {
              const active = language === f.code;
              return (
                <li key={f.code}>
                  <button
                    type="button"
                    onClick={() => setLanguage(f.code)}
                    aria-pressed={active}
                    lang={f.code}
                    className="group flex w-full items-baseline justify-between gap-4 py-1 text-left sm:py-2"
                  >
                    <span
                      className={cn(
                        "relative font-heading text-[1.6rem] font-semibold leading-[1.35] transition-colors sm:text-[2.4rem]",
                        active ? "text-foreground" : "text-muted-foreground/45 group-hover:text-muted-foreground"
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute -left-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent lg:-left-6"
                        />
                      )}
                      {f.word}
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        active ? "font-semibold text-primary" : "text-muted-foreground"
                      )}
                    >
                      {f.lang}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <figcaption className="mt-3 text-sm text-muted-foreground">{t("hero_lang_caption")}</figcaption>
        </figure>
      </section>

      {/* Emergency signs */}
      <section className="mt-20 overflow-hidden rounded-xl bg-primary text-primary-foreground dark:bg-card dark:text-foreground dark:ring-1 dark:ring-border">
        <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <h2 className="max-w-[24ch] text-2xl font-bold leading-tight sm:text-3xl">
              {t("home_emergency_title")}
            </h2>
            <ul className="mt-6 space-y-3">
              {EMERGENCY_PROTOCOLS.map((p) => (
                <li key={p.id} className="flex gap-3 text-[17px] leading-snug">
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  {EMERGENCY_SIGNS[p.id] ?? p.symptomPattern}
                </li>
              ))}
            </ul>
          </div>
          <div className="md:border-l md:border-primary-foreground/20 md:pl-10 md:dark:border-border">
            <a
              href="tel:108"
              className="group inline-flex items-center gap-4 rounded-lg"
              aria-label="Call 108 ambulance"
            >
              <span className="font-heading text-7xl font-extrabold leading-none tracking-tight text-accent sm:text-8xl">
                108
              </span>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:scale-105">
                <Phone className="h-6 w-6" />
              </span>
            </a>
            <p className="mt-3 max-w-[30ch] text-sm leading-relaxed opacity-80">{t("home_emergency_desc")}</p>
          </div>
        </div>
      </section>

      {/* Other destinations */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold sm:text-3xl">{t("home_more_title")}</h2>
        <ul className="mt-6 grid border-t md:grid-cols-3 md:divide-x">
          {destinations.map((d) => {
            const Icon = d.icon;
            return (
              <li key={d.href} className="border-b md:border-b-0">
                <Link href={d.href} className="group flex h-full flex-col gap-2 py-6 md:px-6 md:first:pl-0">
                  <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  <span className="mt-2 font-heading text-xl font-semibold">{t(d.title)}</span>
                  <span className="text-[15px] leading-relaxed text-muted-foreground">{t(d.desc)}</span>
                  <span className="mt-auto pt-3 text-[15px] font-semibold text-primary underline decoration-primary/30 underline-offset-4 group-hover:decoration-primary">
                    {t(d.cta)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Recent advisories */}
      <section className="mt-20">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="text-2xl font-bold sm:text-3xl">{t("home_alerts_title")}</h2>
          <Link
            href="/alerts"
            className="text-[15px] font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
          >
            {t("home_alerts_all")}
          </Link>
        </div>
        <ul className="mt-6 divide-y border-y">
          {recentOutbreaks.map((o) => {
            return (
              <li key={o.id} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 py-5 sm:grid-cols-[10rem_1fr_auto]">
                <SeverityMark severity={o.severity} className="sm:row-span-2 sm:items-start sm:pt-1.5" />
                <span className="col-start-1 font-heading text-lg font-semibold sm:col-start-2">
                  {o.disease}
                  <span className="font-sans text-base font-normal text-muted-foreground">
                    {" "}in {o.district}, {o.state}
                  </span>
                </span>
                <span className="col-start-2 row-span-2 row-start-1 text-right sm:col-start-3">
                  <span className="block font-heading text-2xl font-bold tabular-nums leading-none">{o.casesCount}</span>
                  <span className="text-sm text-muted-foreground">{t("cases")}</span>
                </span>
                <p className="col-span-2 col-start-1 mt-1 max-w-[70ch] text-[15px] leading-relaxed text-muted-foreground sm:col-span-1 sm:col-start-2 sm:mt-0">
                  {o.advisory}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">{t("home_alerts_demo")}</p>
      </section>
    </AppShell>
  );
}
