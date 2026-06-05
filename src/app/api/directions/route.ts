import { NextResponse } from "next/server";

export const maxDuration = 15;

export async function POST(req: Request) {
  console.log("\x1b[32m%s\x1b[0m", "\n📥 [API Directions] Received directions request...");

  try {
    const { originLat, originLng, destinationLat, destinationLng, hospitalName } = await req.json();

    if (
      typeof originLat !== "number" || typeof originLng !== "number" ||
      typeof destinationLat !== "number" || typeof destinationLng !== "number"
    ) {
      return NextResponse.json({ error: "Origin and destination coordinates are required." }, { status: 400 });
    }

    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!mapsKey) {
      console.warn("⚠️ [API Directions] GOOGLE_MAPS_API_KEY not set. Returning estimate.");
      return getEstimatedDirections(originLat, originLng, destinationLat, destinationLng, hospitalName);
    }

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `${originLat},${originLng}`);
    url.searchParams.set("destination", `${destinationLat},${destinationLng}`);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("key", mapsKey);

    console.log(`📍 [API Directions] Requesting route: [${originLat},${originLng}] → [${destinationLat},${destinationLng}]`);
    const startTime = Date.now();

    const res = await fetch(url.toString());
    const duration = Date.now() - startTime;
    console.log(`📍 [API Directions] Response: ${res.status} (${duration}ms)`);

    if (!res.ok) {
      console.error("❌ [API Directions] Directions API request failed.");
      return getEstimatedDirections(originLat, originLng, destinationLat, destinationLng, hospitalName);
    }

    const data = await res.json();

    if (data.status !== "OK" || !data.routes?.length) {
      console.warn(`⚠️ [API Directions] No routes found. Status: ${data.status}`);
      return getEstimatedDirections(originLat, originLng, destinationLat, destinationLng, hospitalName);
    }

    const leg = data.routes[0].legs[0];
    console.log(`✅ [API Directions] Route found: ${leg.distance.text} / ${leg.duration.text}`);

    return NextResponse.json({
      success: true,
      hospitalName: hospitalName || "Hospital",
      distance: leg.distance.text,
      duration: leg.duration.text,
      origin: { latitude: originLat, longitude: originLng },
      destination: { latitude: destinationLat, longitude: destinationLng },
      source: "google_directions",
    });
  } catch (error: any) {
    console.error("❌ [API Directions] Critical error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}

function getEstimatedDirections(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  hospitalName?: string
) {
  const distKm = Math.sqrt(
    Math.pow(destLat - originLat, 2) + Math.pow(destLng - originLng, 2)
  ) * 111;
  const distText = `${distKm.toFixed(1)} km`;
  const durationMins = Math.ceil(distKm * 3);
  const durationText = durationMins < 60
    ? `${durationMins} mins`
    : `${Math.floor(durationMins / 60)} hr ${durationMins % 60} mins`;

  return NextResponse.json({
    success: true,
    hospitalName: hospitalName || "Hospital",
    distance: distText,
    duration: durationText,
    origin: { latitude: originLat, longitude: originLng },
    destination: { latitude: destLat, longitude: destLng },
    source: "estimated",
  });
}
