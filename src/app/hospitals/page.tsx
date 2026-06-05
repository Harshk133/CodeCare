import { Metadata } from "next";
import HospitalsClient from "./HospitalsClient";

export const metadata: Metadata = {
  title: "Specialized Hospital Finder - SwasthyaAI",
  description: "Locate nearby clinics, primary health centers (PHCs), and specialized hospital wards near your location.",
};

export default function HospitalsPage() {
  return <HospitalsClient />;
}
