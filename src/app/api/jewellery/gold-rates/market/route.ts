import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isJewelleryModuleEnabled } from "@/lib/auth-utils";

// In-memory cache (5 minutes)
let cachedRates: MarketRateResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface MarketRate {
  karat: string;
  purity: string;
  perGram: number;
  perPavan: number; // 8 grams — Kerala standard
  per10Gram: number;
}

interface MarketRateResponse {
  rates: MarketRate[];
  goldUsdPerOz: number;
  usdInrRate: number;
  lastUpdated: string;
  source: string;
}

const KARAT_FACTORS: Record<string, { label: string; factor: number }> = {
  K24: { label: "24K (999)", factor: 1.0 },
  K22: { label: "22K (916)", factor: 22 / 24 },
  K21: { label: "21K (875)", factor: 21 / 24 },
  K18: { label: "18K (750)", factor: 18 / 24 },
  K14: { label: "14K (583)", factor: 14 / 24 },
  K9: { label: "9K (375)", factor: 9 / 24 },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function fetchMarketRates(): Promise<MarketRateResponse> {
  // Check cache first
  if (cachedRates && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedRates;
  }

  // Source 1: gold-api.com (free, no key) — returns USD/troy oz
  // Source 2: open.er-api.com (free, no key) — returns USD/INR rate
  const [goldRes, forexRes] = await Promise.all([
    fetch("https://api.gold-api.com/price/XAU", { signal: AbortSignal.timeout(8000) }),
    fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) }),
  ]);

  if (!goldRes.ok || !forexRes.ok) {
    throw new Error("Failed to fetch market rates");
  }

  const goldData = await goldRes.json();
  const forexData = await forexRes.json();

  const goldUsdPerOz: number = goldData.price; // USD per troy ounce
  const usdInrRate: number = forexData.rates?.INR;

  if (!goldUsdPerOz || !usdInrRate) {
    throw new Error("Invalid API response");
  }

  // Convert: USD/troy oz → INR/gram
  // 1 troy ounce = 31.1035 grams
  const gold24kPerGram = round2((goldUsdPerOz * usdInrRate) / 31.1035);

  const rates: MarketRate[] = Object.entries(KARAT_FACTORS).map(([karat, { label, factor }]) => {
    const perGram = round2(gold24kPerGram * factor);
    return {
      karat,
      purity: label,
      perGram,
      perPavan: round2(perGram * 8), // 1 Pavan = 8 grams (Kerala)
      per10Gram: round2(perGram * 10),
    };
  });

  const result: MarketRateResponse = {
    rates,
    goldUsdPerOz: round2(goldUsdPerOz),
    usdInrRate: round2(usdInrRate),
    lastUpdated: new Date().toISOString(),
    source: "gold-api.com",
  };

  // Cache the result
  cachedRates = result;
  cacheTimestamp = Date.now();

  return result;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isJewelleryModuleEnabled(session)) {
      return NextResponse.json({ error: "Jewellery module is not enabled" }, { status: 403 });
    }

    const data = await fetchMarketRates();
    return NextResponse.json(data);
  } catch (error) {
    // Return graceful fallback — never block the UI
    return NextResponse.json(
      { rates: null, error: "Unable to fetch live market rates", lastUpdated: null, source: null },
      { status: 200 } // 200 intentionally — this is a soft failure
    );
  }
}
