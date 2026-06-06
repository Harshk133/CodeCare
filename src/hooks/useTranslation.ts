"use client";

import { useHealthStore } from "@/store/useHealthStore";
import { t } from "@/lib/translations";

export function useTranslation() {
  const language = useHealthStore((s) => s.language);
  return { t: (key: string) => t(language, key), language };
}
