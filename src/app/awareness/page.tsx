"use client";

import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { useTranslation } from "@/hooks/useTranslation";
import { DISEASES_KNOWLEDGE } from "@/constants/medicalKnowledge";

const CATEGORY_LABEL: Record<string, string> = {
  viral: "Viral infection",
  infection: "Parasitic infection",
  respiratory: "Respiratory illness",
  bacterial: "Bacterial infection",
  general: "General",
};

/** Drop parenthetical asides so the preview reads as a short list. */
const shorten = (s: string) => s.replace(/\s*\(.*?\)/g, "");

export default function AwarenessPage() {
  const { t } = useTranslation();

  return (
    <AppShell>
      <header>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{t("awareness_title")}</h1>
        <p className="mt-2 max-w-[60ch] text-lg leading-relaxed text-muted-foreground">{t("awareness_desc")}</p>
      </header>

      <ul className="mt-10 grid gap-x-12 border-t md:grid-cols-2">
        {DISEASES_KNOWLEDGE.map((d) => (
          <li key={d.id} className="border-b">
            <Link href={`/awareness/${d.id}`} className="group block py-7">
              <span className="text-sm text-muted-foreground">{CATEGORY_LABEL[d.category] ?? d.category}</span>
              <span className="mt-1 block font-heading text-[1.75rem] font-bold leading-tight group-hover:text-primary">
                {d.name}
              </span>
              <span className="mt-2 block max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">
                {d.symptoms.slice(0, 3).map(shorten).join(", ")}, and more.
              </span>
              <span className="mt-4 inline-block text-[15px] font-semibold text-primary underline decoration-primary/30 underline-offset-4 group-hover:decoration-primary">
                Symptoms, warning signs and prevention
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
