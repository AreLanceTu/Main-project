export type GeoCountryResult = {
  countryCode: string | null;
  provider: string | null;
  ip: string | null;
  error?: string;
};

export type GeoResolveOptions = {
  /**
   * When true (default), uses sessionStorage cache if present.
   * Set to false for security-sensitive flows like freelancer registration.
   */
  useCache?: boolean;
};

const CACHE_COUNTRY_KEY = "geo_country_code";
const CACHE_PROVIDER_KEY = "geo_provider";
const CACHE_IP_KEY = "geo_ip";

async function fetchJsonWithTimeout(url: string, timeoutMs = 6000): Promise<any> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function resolveCountryCode(options: GeoResolveOptions = {}): Promise<GeoCountryResult> {
  const useCache = options.useCache !== false;
  const cached = sessionStorage.getItem(CACHE_COUNTRY_KEY);
  const cachedProvider = sessionStorage.getItem(CACHE_PROVIDER_KEY);
  const cachedIp = sessionStorage.getItem(CACHE_IP_KEY);

  if (useCache && cached) {
    return {
      countryCode: cached,
      provider: cachedProvider || "cache",
      ip: cachedIp || null,
    };
  }

  const providers: Array<{
    name: string;
    url: string;
    pick: (d: any) => string | null;
    ip?: (d: any) => string | null;
    error?: (d: any) => string | undefined;
  }> = [
    {
      name: "country.is",
      url: "https://api.country.is/",
      pick: (d) => d?.country ?? null,
      ip: (d) => d?.ip ?? null,
      error: (d) => d?.message,
    },
    {
      name: "ipwho.is",
      url: "https://ipwho.is/?fields=success,message,country_code",
      pick: (d) => (d?.success ? d?.country_code : null),
      ip: (d) => d?.ip ?? null,
      error: (d) => d?.message,
    },
    {
      name: "ipapi.co",
      url: "https://ipapi.co/json/",
      pick: (d) => d?.country_code ?? null,
      ip: (d) => d?.ip ?? null,
      error: (d) => (d?.error ? String(d?.reason ?? "Geo lookup failed") : undefined),
    },
    {
      name: "freeipapi.com",
      url: "https://freeipapi.com/api/json/",
      pick: (d) => d?.countryCode ?? null,
      ip: (d) => d?.ipAddress ?? d?.ip ?? null,
      error: (d) => d?.message,
    },
  ];

  let lastError = "";
  for (const p of providers) {
    try {
      const data = await fetchJsonWithTimeout(p.url);
      const code = p.pick(data);
      if (code) {
        const ip = p.ip ? p.ip(data) : null;
        sessionStorage.setItem(CACHE_COUNTRY_KEY, code);
        sessionStorage.setItem(CACHE_PROVIDER_KEY, p.name);
        if (ip) sessionStorage.setItem(CACHE_IP_KEY, ip);
        return { countryCode: code, provider: p.name, ip };
      }
      lastError = (p.error ? p.error(data) : undefined) || lastError;
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  return {
    countryCode: null,
    provider: null,
    ip: null,
    error: lastError || "Geo lookup failed",
  };
}

export async function ensureFreelancerEligibility(options: GeoResolveOptions = {}): Promise<
  | { ok: true; geo: GeoCountryResult }
  | { ok: false; reason: "unknown" | "not_india"; geo: GeoCountryResult }
> {
  const geo = await resolveCountryCode(options);
  if (!geo.countryCode) return { ok: false, reason: "unknown", geo };
  if (geo.countryCode !== "IN") return { ok: false, reason: "not_india", geo };
  return { ok: true, geo };
}
