import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shared/AppShell";
import { DISEASES_KNOWLEDGE } from "@/constants/medicalKnowledge";
import { ArrowLeft, Phone, MessageCircle } from "lucide-react";

// Required for next.js static HTML export of dynamic routes
export function generateStaticParams() {
  return DISEASES_KNOWLEDGE.map((d) => ({ disease: d.id }));
}

interface DiseasePageProps {
  params: Promise<{ disease: string }>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-[17px] leading-relaxed">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function DiseaseDetailPage({ params }: DiseasePageProps) {
  // Await the dynamic parameters (standard requirement in Next.js 15 App Router)
  const { disease: id } = await params;
  const disease = DISEASES_KNOWLEDGE.find((d) => d.id === id);
  if (!disease) notFound();

  const { allopathyTreatment: allo, homeopathyTreatment: homeo } = disease;

  return (
    <AppShell>
      <Link
        href="/awareness"
        className="inline-flex items-center gap-1.5 text-[15px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All diseases
      </Link>

      <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">{disease.name}</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="max-w-[68ch] space-y-10">
          <Section title="Common symptoms">
            <Bullets items={disease.symptoms} />
          </Section>

          <Section title="How to prevent it">
            <Bullets items={disease.prevention} />
          </Section>

          <Section title="Treatment">
            <p className="text-[17px] leading-relaxed text-muted-foreground">{allo.description}</p>
            <h3 className="mt-6 text-lg font-semibold">Care and monitoring</h3>
            <div className="mt-2"><Bullets items={allo.management} /></div>
            <h3 className="mt-6 text-lg font-semibold">Medicines</h3>
            <div className="mt-2"><Bullets items={allo.medications} /></div>
            {allo.warnings.length > 0 && (
              <div className="mt-6 rounded-lg border border-caution/40 bg-caution/10 p-4 text-[15px] leading-relaxed">
                {allo.warnings.join(" ")}
              </div>
            )}
          </Section>

          <Section title="WHO guidance for health workers">
            <Bullets items={disease.whoGuidelines} />
          </Section>

          <Section title="Homeopathic support">
            <p className="text-[17px] leading-relaxed text-muted-foreground">{homeo.description}</p>
            <dl className="mt-4 divide-y border-y">
              {homeo.remedies.map((r) => (
                <div key={r.name} className="py-3">
                  <dt className="font-semibold">{r.name}</dt>
                  <dd className="mt-0.5 text-[15px] leading-relaxed text-muted-foreground">{r.indication}</dd>
                </div>
              ))}
            </dl>
            {homeo.warnings.length > 0 && (
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{homeo.warnings.join(" ")}</p>
            )}
          </Section>
        </div>

        {/* Warning signs stay in view on wide screens: the one thing a reader must not miss */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border-2 border-destructive/40 bg-card p-5">
            <h2 className="text-xl font-bold leading-tight text-destructive">Go to a hospital immediately if you notice</h2>
            <ul className="mt-4 space-y-2 text-[15px] leading-snug">
              {disease.emergencyTriggers.map((tr) => (
                <li key={tr} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.45em] h-2 w-2 shrink-0 rounded-full bg-destructive" />
                  {tr}
                </li>
              ))}
            </ul>
            <a
              href="tel:108"
              className="mt-5 flex h-11 items-center justify-center gap-2 rounded-lg bg-destructive text-[15px] font-semibold text-destructive-foreground"
            >
              <Phone className="h-4 w-4" aria-hidden="true" /> Call 108
            </a>
          </div>

          <Link
            href={`/chat?q=${encodeURIComponent(`I think I may have ${disease.name}. What should I do?`)}`}
            className="mt-4 flex h-11 items-center justify-center gap-2 rounded-lg border-2 border-primary/30 bg-card text-[15px] font-semibold transition-colors hover:border-primary"
          >
            <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
            Ask about your symptoms
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
