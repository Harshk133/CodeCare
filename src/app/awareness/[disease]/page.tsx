import React from "react";
import { AppShell } from "@/components/shared/AppShell";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

// Required for next.js static HTML export of dynamic routes
export function generateStaticParams() {
  return [
    { disease: "dengue" },
    { disease: "malaria" },
    { disease: "covid" },
    { disease: "tuberculosis" },
    { disease: "fever" },
  ];
}

interface DiseasePageProps {
  params: Promise<{ disease: string }> | { disease: string };
}

export default async function DiseaseDetailPage({ params }: DiseasePageProps) {
  // Await the dynamic parameters (standard requirement in Next.js 15 App Router)
  const resolvedParams = await params;
  const disease = resolvedParams.disease;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <Link
          href="/awareness"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>
        <div className="rounded-3xl border bg-card p-6 md:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mb-4">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="font-heading text-3xl font-bold capitalize tracking-tight">
            About {disease}
          </h1>
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
            Detailed clinical guidelines, preventative measures, symptom highlights, and medical advice about <strong className="capitalize">{disease}</strong> are being compiled here.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
