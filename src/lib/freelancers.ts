import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";

import { ensureFreelancerEligibility } from "@/lib/geo";

export type FreelancerRecord = {
  uid: string;
  status: "active";
  createdAt: any;
  updatedAt: any;
  geoCountryCode: string | null;
  geoProvider: string | null;
  geoIp: string | null;
  profile?: {
    fullName: string;
    phone: string;
    title: string;
    bio: string;
    city: string;
    state: string;
    primaryCategory?: string;
    skills?: string[];
    portfolioUrl?: string;
  };
};

export type FreelancerProfileInput = {
  fullName: string;
  phone: string;
  title: string;
  bio: string;
  city: string;
  state: string;
  primaryCategory?: string;
  skills?: string[];
  portfolioUrl?: string;
};

function normalizeProfile(input: FreelancerProfileInput): FreelancerProfileInput {
  const fullName = String(input.fullName ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const title = String(input.title ?? "").trim();
  const bio = String(input.bio ?? "").trim();
  const city = String(input.city ?? "").trim();
  const state = String(input.state ?? "").trim();

  const primaryCategory = input.primaryCategory ? String(input.primaryCategory).trim() : undefined;

  const skills = Array.isArray(input.skills)
    ? input.skills
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 30)
    : undefined;

  const portfolioUrl = input.portfolioUrl ? String(input.portfolioUrl).trim() : undefined;

  if (!fullName) throw new Error("Full name is required");
  if (!phone) throw new Error("Phone number is required");
  if (!title) throw new Error("Professional title is required");
  if (!bio) throw new Error("Bio is required");
  if (bio.length < 30) throw new Error("Bio must be at least 30 characters");
  if (!city) throw new Error("City is required");
  if (!state) throw new Error("State is required");

  if (portfolioUrl) {
    // Keep validation light; just reject obviously bad inputs.
    try {
      const u = new URL(portfolioUrl);
      if (!(u.protocol === "http:" || u.protocol === "https:")) {
        throw new Error();
      }
    } catch {
      throw new Error("Portfolio URL must be a valid http(s) URL");
    }
  }

  const out: FreelancerProfileInput = {
    fullName,
    phone,
    title,
    bio,
    city,
    state,
  };

  if (primaryCategory) out.primaryCategory = primaryCategory;
  if (skills?.length) out.skills = skills;
  if (portfolioUrl) out.portfolioUrl = portfolioUrl;

  return out;
}

export async function isFreelancerRegistered(db: Firestore, uid: string): Promise<boolean> {
  if (!uid) return false;
  const snap = await getDoc(doc(db, "freelancers", uid));
  return snap.exists();
}

/**
 * Registers the currently logged-in user as a freelancer.
 * Enforced client-side with Geo-IP (India only), and persisted in Firestore.
 */
export async function registerAsFreelancer(
  db: Firestore,
  uid: string,
  profile: FreelancerProfileInput,
) {
  if (!uid) throw new Error("Missing uid");
  const normalizedProfile = normalizeProfile(profile);

  // Security-sensitive: force a fresh Geo-IP lookup (don't rely on session cache).
  const eligibility = await ensureFreelancerEligibility({ useCache: false });
  if (!eligibility.ok) {
    const reason = eligibility.reason;
    if (reason === "not_india") {
      throw new Error("Freelancer registration is only available in India (based on your IP address).");
    }
    throw new Error(
      "We couldn’t verify your country from your IP. Please try again (disable VPN/ad-blockers if enabled).",
    );
  }

  const freelancerRef = doc(db, "freelancers", uid);
  const existing = await getDoc(freelancerRef);

  const payload: Partial<FreelancerRecord> = {
    uid,
    status: "active",
    updatedAt: serverTimestamp(),
    geoCountryCode: eligibility.geo.countryCode ?? null,
    geoProvider: eligibility.geo.provider ?? null,
    geoIp: eligibility.geo.ip ?? null,
    profile: normalizedProfile,
  };

  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
  }

  try {
    await setDoc(freelancerRef, payload, { merge: true });

    // Keep /users/{uid}.role in sync for convenience.
    await setDoc(
      doc(db, "users", uid),
      {
        role: "freelancer",
        freelancerRegisteredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err: any) {
    const code = err?.code || err?.name;
    const msg = String(err?.message || "");
    if (code === "permission-denied" || /missing or insufficient permissions/i.test(msg)) {
      throw new Error(
        "Firestore permission denied. Deploy the updated Firestore rules (firestore.rules) to Firebase, then try again.",
      );
    }
    throw err;
  }

  return eligibility;
}
