"use client";

import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import { SeverityMark } from "@/components/shared/SeverityMark";
import { useTranslation } from "@/hooks/useTranslation";
import { MOCK_OUTBREAKS } from "@/constants/medicalKnowledge";

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 } as const;

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function AlertsPage() {
  const { t } = useTranslation();

  const outbreaks = [...MOCK_OUTBREAKS].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.date.localeCompare(a.date)
  );

  return (
    <AppShell>
      <header>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{t("alerts_title")}</h1>
        <p className="mt-2 max-w-[60ch] text-lg leading-relaxed text-muted-foreground">{t("alerts_desc")}</p>
        <p className="mt-3 text-sm text-muted-foreground">{t("home_alerts_demo")}</p>
      </header>

      <ol className="mt-10 divide-y border-y">
        {outbreaks.map((o) => (
          <li key={o.id} className="grid gap-x-10 gap-y-3 py-8 md:grid-cols-[11rem_minmax(0,1fr)_7rem]">
            <div className="flex items-center justify-between gap-4 md:block">
              <SeverityMark severity={o.severity} />
              <time dateTime={o.date} className="text-sm text-muted-foreground md:mt-1.5 md:block">
                {formatDate(o.date)}
              </time>
            </div>

            <div>
              <h2 className="text-2xl font-bold leading-tight">{o.disease}</h2>
              <p className="mt-0.5 text-[15px] text-muted-foreground">
                {o.district}, {o.state}
              </p>
              <p className="mt-3 max-w-[64ch] text-[17px] leading-relaxed">{o.advisory}</p>
              <Link
                href={`/chat?q=${encodeURIComponent(`How can I protect myself from ${o.disease} in ${o.district}?`)}`}
                className="mt-3 inline-block text-[15px] font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
              >
                Ask how to protect yourself
              </Link>
            </div>

            <div className="order-first md:order-none md:text-right">
              <span className="font-heading text-4xl font-bold tabular-nums leading-none">{o.casesCount}</span>
              <span className="ml-1.5 text-sm text-muted-foreground md:ml-0 md:block">{t("cases")}</span>
            </div>
          </li>
        ))}
      </ol>
    </AppShell>
  );
}
