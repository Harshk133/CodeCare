import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/shared/AppShell";
import {
  MessageSquare,
  MapPin,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  Shield,
  Activity,
  UserCheck,
  Languages,
} from "lucide-react";

export default function HomePage() {
  const quickActions = [
    {
      title: "AI Health Assistant",
      description: "Describe symptoms to get instant triage guidance & medical advice.",
      href: "/chat",
      icon: MessageSquare,
      color: "from-teal-500 to-emerald-500 shadow-teal-500/20",
      buttonText: "Start Chat",
    },
    {
      title: "Hospital Finder",
      description: "Locate nearby hospitals, clinics, & primary health centers.",
      href: "/hospitals",
      icon: MapPin,
      color: "from-cyan-500 to-blue-500 shadow-cyan-500/20",
      buttonText: "Find Care",
    },
    {
      title: "Outbreak Alerts",
      description: "Monitor active public health alerts & government advisories.",
      href: "/alerts",
      icon: AlertTriangle,
      color: "from-amber-500 to-orange-500 shadow-amber-500/20",
      buttonText: "View Alerts",
    },
    {
      title: "Disease Awareness",
      description: "Read verified guidelines on Dengue, Malaria, COVID, & TB.",
      href: "/awareness",
      icon: BookOpen,
      color: "from-purple-500 to-indigo-500 shadow-purple-500/20",
      buttonText: "Learn More",
    },
  ];

  const benefits = [
    {
      title: "Multilingual Intelligence",
      description: "Access care in 7 regional Indian languages (English, Hindi, Marathi, etc.) with automatic translation and voice query support.",
      icon: Languages,
    },
    {
      title: "Explainable Risk Engine",
      description: "Triage results range from Low to Emergency, coupled with clear explanations of why certain symptoms trigger warnings.",
      icon: Activity,
    },
    {
      title: "Rural-First Optimization",
      description: "Designed for low-bandwidth environments, lightweight assets, and full portability inside native mobile devices using CapacitorJS.",
      icon: UserCheck,
    },
  ];

  return (
    <AppShell>
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 px-6 py-12 text-white shadow-xl md:px-12 md:py-20">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3.5 py-1 text-xs font-semibold text-teal-300">
            <Shield className="h-3.5 w-3.5" />
            AI-Driven Public Health Assistant
          </span>
          <h1 className="mt-6 font-heading text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Trusted Healthcare Awareness for{" "}
            <span className="bg-gradient-to-r from-teal-300 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Every Indian
            </span>
          </h1>
          <p className="mt-6 text-sm sm:text-lg text-slate-300 max-w-xl leading-relaxed">
            Understand symptoms, locate nearby emergency care facilities, and receive verified disease prevention tips in your local language.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/chat"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-3.5 text-sm font-semibold text-slate-950 transition-all hover:bg-teal-400 hover:scale-105 active:scale-95 shadow-lg shadow-teal-500/25"
            >
              Consult Assistant
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/hospitals"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-md px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:border-slate-600 active:scale-95"
            >
              Locate Nearby Hospitals
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Actions Grid */}
      <section className="mt-12">
        <div className="flex flex-col gap-2 mb-8">
          <h2 className="font-heading text-2xl font-bold tracking-tight">
            How Can We Help You Today?
          </h2>
          <p className="text-sm text-muted-foreground">
            Access our core public health awareness toolset designed for rapid access.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <div
                key={idx}
                className="group flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div>
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${action.color}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-bold">
                    {action.title}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {action.description}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t">
                  <Link
                    href={action.href}
                    className="inline-flex w-full items-center justify-between text-xs font-semibold text-primary transition-colors group-hover:text-teal-600 dark:group-hover:text-teal-400"
                  >
                    <span>{action.buttonText}</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Core Platform Benefits */}
      <section className="mt-16 rounded-3xl border bg-slate-50 dark:bg-slate-900/50 p-6 md:p-12">
        <div className="max-w-2xl flex flex-col gap-2 mb-10">
          <h2 className="font-heading text-2xl font-bold tracking-tight">
            Designed for Accessibility and Trust
          </h2>
          <p className="text-sm text-muted-foreground">
            SwasthyaAI tackles core regional public health issues using state-of-the-art mobile engineering.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {benefits.map((benefit, idx) => {
            const Icon = benefit.icon;
            return (
              <div key={idx} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-primary dark:bg-teal-500/5">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-slate-800 dark:text-slate-200">
                    {benefit.title}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
