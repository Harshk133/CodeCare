import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-6 text-foreground">
      <div className="mx-auto w-full max-w-xl">
        <p className="font-heading text-8xl font-extrabold leading-none text-accent">404</p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">This page doesn&apos;t exist</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
          The link may be old or mistyped. If you need medical help right now, call 108.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground"
          >
            Go to home page
          </Link>
          <a
            href="tel:108"
            className="inline-flex h-11 items-center rounded-lg border-2 border-destructive/40 px-5 text-[15px] font-semibold text-destructive"
          >
            Call 108
          </a>
        </div>
      </div>
    </div>
  );
}
