import { NextResponse } from "next/server";

export const maxDuration = 15;

export async function POST(req: Request) {
  console.log("\x1b[32m%s\x1b[0m", "\n📥 [API Hospitals] Received nearby hospital search request...");

  try {
    const { latitude, longitude, radius = 5000 } = await req.json();

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "latitude and longitude are required numbers." }, { status: 400 });
    }

    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!mapsKey) {
      console.warn("⚠️ [API Hospitals] GOOGLE_MAPS_API_KEY not set. Returning mock data.");
      return NextResponse.json({ hospitals: getMockHospitals(latitude, longitude), source: "mock" });
    }

    console.log(`📍 [API Hospitals] Searching near [${latitude}, ${longitude}] radius: ${radius}m`);

    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": mapsKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.nationalPhoneNumber",
          "places.rating",
          "places.types",
          "places.regularOpeningHours",
        ].join(","),
      },
      body: JSON.stringify({
        includedTypes: ["hospital", "doctor", "health"],
        maxResultCount: 10,
        locationRestriction: {
          circle: {
            center: { latitude, longitude },
            radius: parseFloat(radius),
          },
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ [API Hospitals] Places API error (${res.status}):`, err);
      return NextResponse.json({ hospitals: getMockHospitals(latitude, longitude), source: "mock_fallback" });
    }

    const data = await res.json();
    const places = data.places || [];
    console.log(`✅ [API Hospitals] Found ${places.length} places from Google Places API.`);

    const hospitals = places.map((place: any) => {
      const loc = place.location || {};
      const lat = loc.latitude ?? latitude;
      const lng = loc.longitude ?? longitude;
      const dist = Math.sqrt(
        Math.pow(lat - latitude, 2) + Math.pow(lng - longitude, 2)
      ) * 111;

      return {
        id: place.id || `place-${Math.random()}`,
        name: place.displayName?.text || "Unknown Hospital",
        address: place.formattedAddress || "",
        phone: place.nationalPhoneNumber || "",
        rating: place.rating ?? null,
        hasEmergency24_7: place.types?.includes("hospital") ?? false,
        coordinates: { latitude: lat, longitude: lng },
        specialties: deriveSpecialties(place.types || []),
        distance: parseFloat(dist.toFixed(1)),
        matchesSpecialty: false,
      };
    }).sort((a: any, b: any) => a.distance - b.distance);

    return NextResponse.json({ hospitals, source: "google_places" });
  } catch (error: any) {
    console.error("❌ [API Hospitals] Critical error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}

function deriveSpecialties(types: string[]): string[] {
  const map: Record<string, string> = {
    hospital: "general medicine",
    doctor: "general medicine",
    physiotherapist: "physiotherapy",
    dentist: "dentistry",
    pharmacy: "pharmacy",
    health: "health",
  };
  return [...new Set(types.map((t) => map[t]).filter(Boolean))];
}

function getMockHospitals(lat: number, lng: number) {
  const MOCK = [
    {
      id: "hosp-1", name: "Sanjeevan Specialty Hospital",
      address: "Deccan Gymkhana, Pune, Maharashtra 411004", phone: "+91 20 2567 8000",
      hasEmergency24_7: true, coordinates: { latitude: 18.5144, longitude: 73.8412 },
      specialties: ["dengue", "malaria", "fever", "infectious diseases"],
    },
    {
      id: "hosp-2", name: "Kamla Nehru Municipal Hospital",
      address: "Mangalwar Peth, Pune, Maharashtra 411011", phone: "+91 20 2447 3012",
      hasEmergency24_7: true, coordinates: { latitude: 18.5282, longitude: 73.8631 },
      specialties: ["dengue", "malaria", "tuberculosis", "general medicine"],
    },
    {
      id: "hosp-3", name: "Ruby Hall Clinic (Emergency Care)",
      address: "Sassoon Road, Pune, Maharashtra 411001", phone: "+91 20 6645 5100",
      hasEmergency24_7: true, coordinates: { latitude: 18.5325, longitude: 73.8788 },
      specialties: ["cardiology", "stroke", "emergency", "intensive care"],
    },
    {
      id: "hosp-4", name: "Primary Health Centre (PHC) Mulshi",
      address: "Mulshi Road, Maharashtra 411042", phone: "+91 20 2292 2011",
      hasEmergency24_7: false, coordinates: { latitude: 18.5085, longitude: 73.6195 },
      specialties: ["fever", "malaria", "general medicine", "vaccination"],
    },
  ];

  return MOCK.map((h) => {
    const dist = Math.sqrt(
      Math.pow(h.coordinates.latitude - lat, 2) + Math.pow(h.coordinates.longitude - lng, 2)
    ) * 111;
    return { ...h, distance: parseFloat(dist.toFixed(1)), matchesSpecialty: false };
  }).sort((a, b) => a.distance - b.distance);
}
