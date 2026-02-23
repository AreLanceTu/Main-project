import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import * as RechartsPrimitive from "recharts";
import { useNavigate } from "react-router-dom";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { auth, db } from "@/firebase";
import { supabase } from "@/supabase";
import { setUserRole } from "@/auth/role";
import {
  getWithdrawalsApiUrlOverride,
  getWithdrawalsUseSupabaseDemoOverride,
  listWithdrawals,
  setWithdrawalsApiUrlOverride,
  setWithdrawalsUseSupabaseDemoOverride,
} from "@/lib/withdrawals";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { getStoredGig, listStoredGigs, removeStoredGig, upsertStoredGig } from "@/lib/gigStore";
import { resolveGigCoverUrl } from "@/lib/gigCovers";
import { getFirebaseIdToken, getFunctionsBaseUrl } from "@/lib/functionsClient";
import { openRazorpayCheckout, verifyRazorpayPayment } from "@/lib/payments";
import { storePaymentInFirestore } from "@/lib/paymentFirestore";
import { getMySubscriptionStatus } from "@/lib/subscriptions";
import { upsertFirestoreServices } from "@/lib/services";
import { upsertFirestoreGig } from "@/lib/firestoreGigs";
import { supabaseUploadViaFunction } from "@/lib/supabaseStorage";

function formatCurrency(amount) {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInr(amountRupees) {
  const value = typeof amountRupees === "number" && Number.isFinite(amountRupees) ? amountRupees : 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function conversionRate({ clicks, orders }) {
  if (!clicks) return 0;
  return (orders / clicks) * 100;
}

function statusBadgeVariant(status) {
  if (status === "Active") return "default";
  if (status === "Paused") return "secondary";
  if (status === "Draft") return "outline";
  return "outline";
}

function normalizeWithdrawalStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "pending") return "pending";
  if (s === "processing" || s === "processed") return "processing";
  if (s === "completed" || s === "success" || s === "paid") return "completed";
  if (s === "failed" || s === "rejected" || s === "reversed" || s === "cancelled") return "failed";
  return s || "processing";
}

function withdrawalStatusBadge(status) {
  const s = normalizeWithdrawalStatus(status);
  if (s === "pending") {
    return { label: "Pending", className: "border-yellow-200 bg-yellow-500/10 text-yellow-700" };
  }
  if (s === "processing") {
    return { label: "Processing", className: "border-blue-200 bg-blue-500/10 text-blue-700" };
  }
  if (s === "completed") {
    return { label: "Completed", className: "border-green-200 bg-green-500/10 text-green-700" };
  }
  if (s === "failed") {
    return { label: "Failed", className: "border-red-200 bg-red-500/10 text-red-700" };
  }
  return { label: String(status || "Unknown"), className: "" };
}

function createSeededNumber(seedStr) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i += 1) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function buildSeries({ gigId, days }) {
  const rng = createSeededNumber(`${gigId}:${days}`);
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const base = 60 + Math.floor(rng() * 140);
    const impressions = base * 10 + Math.floor(rng() * 120);
    const clicks = clamp(Math.floor(impressions * (0.02 + rng() * 0.06)), 0, impressions);
    const orders = clamp(Math.floor(clicks * (0.03 + rng() * 0.12)), 0, clicks);
    const earnings = orders * (25 + Math.floor(rng() * 70));
    series.push({
      day: `D-${i}`,
      impressions,
      clicks,
      orders,
      earnings,
    });
  }
  return series;
}

const CATEGORY_OPTIONS = [
  {
    category: "Design",
    subcategories: ["Logo Design", "Branding", "Social Media"],
  },
  {
    category: "Development",
    subcategories: ["Web Apps", "Landing Pages", "Bug Fixes"],
  },
  {
    category: "Writing",
    subcategories: ["Blog Posts", "Copywriting", "Technical Writing"],
  },
];

export default function FreelancerDashboard() {
  const analyticsRef = useRef(null);
  const withdrawalsRef = useRef(null);
  const gigFormRef = useRef(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState(null);
  const [userUid, setUserUid] = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [openSection, setOpenSection] = useState(null);

  const [proLoading, setProLoading] = useState(false);
  const [proActive, setProActive] = useState(false);
  const [proEndsAt, setProEndsAt] = useState(null);
  const [upgradingPro, setUpgradingPro] = useState(false);

  const [gigs, setGigs] = useState(() => {
    const stored = listStoredGigs();
    if (stored.length) {
      return stored.map((g) => ({
        id: g.gig_id,
        title: g.title,
        thumbnailUrl: g.cover_image_url,
        status: "Active",
        impressions: 0,
        clicks: 0,
        orders: 0,
        sellerId: g.seller_id,
      }));
    }

    return [
      {
        id: "gig-1",
        title: "I will design a modern logo for your brand",
        thumbnailUrl: "",
        status: "Active",
        impressions: 12450,
        clicks: 610,
        orders: 32,
      },
      {
        id: "gig-2",
        title: "I will build a responsive landing page in React",
        thumbnailUrl: "",
        status: "Paused",
        impressions: 8020,
        clicks: 301,
        orders: 12,
      },
      {
        id: "gig-3",
        title: "I will write SEO blog posts for your niche",
        thumbnailUrl: "",
        status: "Draft",
        impressions: 0,
        clicks: 0,
        orders: 0,
      },
    ];
  });

  const [orders, setOrders] = useState(() => []);

  useEffect(() => {
    if (!userUid) {
      setOrders([]);
      return undefined;
    }

    const q = query(
      collection(db, "orders"),
      where("sellerId", "==", userUid),
      limit(50),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => {
          const data = d.data() || {};
          const orderStatus = String(data.orderStatus || "Pending");
          const status = ["In Progress", "Revision", "Pending"].includes(orderStatus)
            ? "Active"
            : orderStatus === "Delivered"
              ? "Delivered"
              : orderStatus;

          const dueTs = data.dueAt;
          let deadlineISO = null;
          try {
            const asDate = dueTs?.toDate?.();
            deadlineISO = asDate ? asDate.toISOString() : null;
          } catch {
            deadlineISO = null;
          }

          let createdAtMs = 0;
          try {
            const createdAsDate = data.createdAt?.toDate?.();
            createdAtMs = createdAsDate ? createdAsDate.getTime() : 0;
          } catch {
            createdAtMs = 0;
          }

          return {
            id: String(data.orderId || d.id),
            clientId: String(data.clientId || ""),
            amountRupees: Number(data.amountRupees || 0),
            deadlineISO,
            status,
            orderStatus,
            createdAtMs,
          };
        });

        items.sort((a, b) => {
          const aMs = Number(a.createdAtMs) || 0;
          const bMs = Number(b.createdAtMs) || 0;
          if (aMs !== bMs) return bMs - aMs;
          return String(b.id).localeCompare(String(a.id));
        });
        setOrders(items);
      },
      () => setOrders([]),
    );

    return unsub;
  }, [userUid]);

  const [withdrawals, setWithdrawals] = useState(() => []);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);

  const [useDemoWithdrawals, setUseDemoWithdrawals] = useState(() => Boolean(getWithdrawalsUseSupabaseDemoOverride()));

  const [withdrawAmount, setWithdrawAmount] = useState(50);

  const [analyticsDays, setAnalyticsDays] = useState("30");
  const [selectedGigId, setSelectedGigId] = useState(() => {
    const stored = listStoredGigs();
    return stored[0]?.gig_id || "gig-1";
  });

  const [gigForm, setGigForm] = useState(() => ({
    editingGigId: null,
    title: "",
    category: CATEGORY_OPTIONS[0].category,
    subcategory: CATEGORY_OPTIONS[0].subcategories[0],
    priceBasic: 25,
    priceStandard: 50,
    pricePremium: 100,
    deliveryTimeDays: 3,
    revisions: 2,
    descriptionHtml: "",
    tags: "",
    images: [],
  }));

  const [aiTitleLoading, setAiTitleLoading] = useState(false);
  const [aiTitleKeyword, setAiTitleKeyword] = useState("");

  function htmlToPlainText(html) {
    if (!html) return "";
    try {
      const doc = new DOMParser().parseFromString(String(html), "text/html");
      return String(doc?.body?.textContent || "").replace(/\s+/g, " ").trim();
    } catch {
      return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  async function generateTitleAi() {
    if (aiTitleLoading) return;

    const description = htmlToPlainText(gigForm.descriptionHtml);
    const keyword = String(aiTitleKeyword || "").trim();
    const category = String(gigForm.category || "").trim();
    const subcategory = String(gigForm.subcategory || "").trim();
    const tags = String(gigForm.tags || "").trim();
    const existingTitle = String(gigForm.title || "").trim();

    if (!category || (!description && !keyword)) {
      toast({
        title: "Add details first",
        description: "Add a keyword (e.g. video editing) or a description before generating a title.",
        variant: "destructive",
      });
      return;
    }

    try {
      setAiTitleLoading(true);
      const token = await getFirebaseIdToken();

      const res = await fetch(`${getFunctionsBaseUrl()}/ai-gig-title`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-firebase-token": token,
        },
        body: JSON.stringify({
          category,
          subcategory,
          description,
          keyword,
          existingTitle,
          tags,
          deliveryTimeDays: gigForm.deliveryTimeDays,
          revisions: gigForm.revisions,
          generateDescription: true,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to generate title"));
      }

      const nextTitle = String(json?.title || "").trim();
      if (!nextTitle) throw new Error("AI did not return a title");

      const nextDescriptionHtml = String(json?.descriptionHtml || "").trim();
      setGigForm((p) => ({
        ...p,
        title: nextTitle,
        ...(nextDescriptionHtml ? { descriptionHtml: nextDescriptionHtml } : {}),
      }));
    } catch (e) {
      toast({
        title: "AI title failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAiTitleLoading(false);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserEmail(u?.email ?? null);
      setUserUid(u?.uid ?? null);

      const fields = [
        Boolean(u?.email),
        Boolean(u?.emailVerified),
        Boolean(u?.displayName),
        Boolean(u?.photoURL),
      ];
      const pct = Math.round((fields.filter(Boolean).length / fields.length) * 100);
      setProfileCompletion(pct);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userUid) {
      setProActive(false);
      setProEndsAt(null);
      return;
    }

    let cancelled = false;
    setProLoading(true);

    getMySubscriptionStatus()
      .then((s) => {
        if (cancelled) return;
        setProActive(Boolean(s?.active));
        setProEndsAt(s?.currentPeriodEnd || null);
      })
      .catch(() => {
        if (cancelled) return;
        setProActive(false);
        setProEndsAt(null);
      })
      .finally(() => {
        if (cancelled) return;
        setProLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userUid]);

  async function upgradeToPro() {
    if (!userUid || upgradingPro) return;

    try {
      setUpgradingPro(true);

      const { orderId, paymentId, signature } = await openRazorpayCheckout({
        amountRupees: 800,
        purpose: "Pro subscription (₹800)",
        prefill: { email: userEmail || undefined },
        notes: {
          purchase_type: "subscription",
          plan: "pro",
          duration_days: 30,
        },
      });

      const verify = await verifyRazorpayPayment({ orderId, paymentId, signature });
      if (!verify?.ok) {
        throw new Error(verify?.error || "Payment verification failed");
      }

      // Store payment details in Firestore (Payments Collection).
      // Best-effort: don't block a successful payment flow.
      try {
        await storePaymentInFirestore({
          paymentId,
          orderId,
          amountRupees: 800,
          currency: "INR",
          purpose: "Pro subscription (₹800)",
          status: "Paid",
          quantityTotal: 30,
          quantityUsed: 0,
          notes: {
            purchase_type: "subscription",
            plan: "pro",
            duration_days: 30,
          },
          related: {
            purchaseType: "subscription",
            plan: "pro",
          },
        });
      } catch (writeErr) {
        console.error("Failed to write Firestore payment", writeErr);
      }

      // This app surfaces badges from Firebase user profile docs.
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await setDoc(
        doc(db, "users", userUid),
        {
          proActive: true,
          verifiedBadge: true,
          proPlan: "pro",
          proEndsAt: end,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      try {
        const status = await getMySubscriptionStatus();
        setProActive(Boolean(status?.active));
        setProEndsAt(status?.currentPeriodEnd || end);
      } catch {
        setProActive(true);
        setProEndsAt(end);
      }

      toast({
        title: "Subscription active",
        description: "Pro is enabled on your profile.",
      });
    } catch (e) {
      toast({
        title: "Upgrade failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpgradingPro(false);
    }
  }

  useEffect(() => {
    if (!userUid) return;

    let cancelled = false;
    let inFlight = false;
    let firstLoad = true;

    async function loadWithdrawals() {
      if (inFlight) return;
      inFlight = true;

      if (firstLoad) setWithdrawalsLoading(true);
      try {
        const list = await listWithdrawals(25);
        const mapped = list.map((w) => ({
          id: w.id,
          amount: Number(w.amount || 0),
          dateISO: w.createdAtISO || w.updatedAtISO || new Date().toISOString(),
          status: normalizeWithdrawalStatus(w.status),
          destinationSummary: w.destinationSummary || "",
        }));

        if (!cancelled) setWithdrawals(mapped);
      } catch (err) {
        if (!cancelled) {
          toast({
            title: "Could not load withdrawals",
            description: err?.message || "Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        firstLoad = false;
        inFlight = false;
        if (!cancelled) setWithdrawalsLoading(false);
      }
    }

    loadWithdrawals();
    const interval = setInterval(loadWithdrawals, 3500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userUid, toast, useDemoWithdrawals]);

  function applyWithdrawalsApiToggle(nextEnabled) {
    const enabled = Boolean(nextEnabled);
    setUseDemoWithdrawals(enabled);

    // Ensure we never point at the old localhost demo server.
    setWithdrawalsApiUrlOverride(null);

    if (!enabled) {
      setWithdrawalsUseSupabaseDemoOverride(false);
      toast({
        title: "Withdrawals source updated",
        description: "Now using Supabase withdrawals endpoints.",
      });
      return;
    }

    setWithdrawalsUseSupabaseDemoOverride(true);
    toast({
      title: "Withdrawals demo enabled",
      description: "Now using Supabase demo withdrawals (simulated success/failure).",
    });
  }

  function switchToClientDashboard() {
    if (!userUid) return;
    setUserRole(userUid, "client");
    navigate("/dashboard");
  }

  const overview = useMemo(() => {
    const activeOrdersCount = orders.filter((o) => o.status === "Active").length;
    const gigImpressions = gigs.reduce((sum, g) => sum + (g.impressions || 0), 0);

    const totalOrders = gigs.reduce((sum, g) => sum + (g.orders || 0), 0);
    const totalEarnings = totalOrders * 60;

    const todayEarnings = Math.round(totalEarnings * 0.07);
    const monthEarnings = Math.round(totalEarnings * 0.48);

    return {
      todayEarnings,
      monthEarnings,
      totalEarnings,
      activeOrdersCount,
      gigImpressions,
    };
  }, [gigs, orders]);

  const selectedGig = useMemo(() => gigs.find((g) => g.id === selectedGigId) ?? gigs[0], [gigs, selectedGigId]);

  const analyticsSeries = useMemo(() => {
    if (!selectedGig) return [];
    return buildSeries({ gigId: selectedGig.id, days: Number(analyticsDays) });
  }, [selectedGig, analyticsDays]);

  const earnings = useMemo(() => {
    const totalGigOrders = gigs.reduce((sum, g) => sum + (g.orders || 0), 0);
    const grossFromGigs = totalGigOrders * 60;
    const grossFromOrders = orders.reduce((sum, o) => sum + (Number(o.amountRupees) || 0), 0);
    const gross = Math.max(grossFromGigs, grossFromOrders);
    const withdrawnCompleted = withdrawals
      .filter((w) => normalizeWithdrawalStatus(w.status) === "completed")
      .reduce((sum, w) => sum + w.amount, 0);
    const pendingClearance = withdrawals
      .filter((w) => {
        const s = normalizeWithdrawalStatus(w.status);
        return s === "pending" || s === "processing";
      })
      .reduce((sum, w) => sum + w.amount, 0);
    const available = Math.max(0, gross - withdrawnCompleted - pendingClearance);

    return {
      available,
      pendingClearance,
      gross,
    };
  }, [gigs, orders, withdrawals]);

  const ordersDerived = useMemo(() => {
    const now = Date.now();
    const active = orders.filter((o) => o.status === "Active");
    const delivered = orders.filter((o) => o.status === "Delivered");
    const late = active.filter((o) => {
      if (!o.deadlineISO) return false;
      return new Date(o.deadlineISO).getTime() < now;
    });
    return { active, delivered, late };
  }, [orders]);

  const hasPendingWithdrawal = useMemo(
    () =>
      withdrawals.some((w) => {
        const s = normalizeWithdrawalStatus(w.status);
        return s === "pending" || s === "processing";
      }),
    [withdrawals],
  );

  function scrollToAnalytics() {
    setOpenSection("analytics");
    requestAnimationFrame(() => {
      analyticsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function scrollToWithdrawals() {
    setOpenSection("withdrawals");
    requestAnimationFrame(() => {
      withdrawalsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  useEffect(() => {
    if (!useDemoWithdrawals) return;
    // Make the demo UI easy to find.
    scrollToWithdrawals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDemoWithdrawals]);

  function resetGigForm() {
    setGigForm({
      editingGigId: null,
      title: "",
      category: CATEGORY_OPTIONS[0].category,
      subcategory: CATEGORY_OPTIONS[0].subcategories[0],
      priceBasic: 25,
      priceStandard: 50,
      pricePremium: 100,
      deliveryTimeDays: 3,
      revisions: 2,
      descriptionHtml: "",
      tags: "",
      images: [],
    });
  }

  function handleCategoryChange(nextCategory) {
    const next = CATEGORY_OPTIONS.find((c) => c.category === nextCategory);
    setGigForm((prev) => ({
      ...prev,
      category: nextCategory,
      subcategory: next?.subcategories?.[0] ?? "",
    }));
  }

  async function uploadGigImages({ gigId, files }) {
    const safeGigId = String(gigId || "").trim();
    if (!safeGigId) return [];
    if (!userUid) throw new Error("Not signed in");
    if (!Array.isArray(files) || files.length === 0) return [];

    function isBucketMissing(err) {
      const message = String(err?.message || err?.error_description || err?.error || "").toLowerCase();
      const status = Number(err?.statusCode || err?.status || 0);
      return status === 404 || message.includes("bucket") && message.includes("not") && message.includes("found");
    }

    // Default to the shared public bucket so thumbnails can load without signed URLs.
    const preferredBucket = String(import.meta.env.VITE_SUPABASE_GIG_IMAGES_BUCKET || "uploads").trim() || "uploads";
    const fallbackBucket = "gig-images";

    const uploaded = [];

    for (const file of files) {
      if (!file) continue;
      if (!file.type?.startsWith("image/")) {
        throw new Error("Please upload only image files for gig images.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Each image must be under 5MB.");
      }

      const safeName = String(file.name || "image").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `gigs/${userUid}/${safeGigId}/${Date.now()}-${safeName}`;

      // Prefer uploading via Edge Function so Storage RLS doesn't block inserts.
      // Try preferred bucket first, then fallback bucket.
      try {
        const res = await supabaseUploadViaFunction({
          bucket: preferredBucket,
          path,
          file,
        });
        uploaded.push({
          bucket: String(res?.bucket || preferredBucket),
          path: String(res?.path || path),
          publicUrl: res?.publicUrl ? String(res.publicUrl) : "",
        });
        continue;
      } catch (e) {
        // If the preferred bucket doesn't exist, try a common fallback.
        if (!isBucketMissing(e)) throw e;
      }

      try {
        const res = await supabaseUploadViaFunction({
          bucket: fallbackBucket,
          path,
          file,
        });
        uploaded.push({
          bucket: String(res?.bucket || fallbackBucket),
          path: String(res?.path || path),
          publicUrl: res?.publicUrl ? String(res.publicUrl) : "",
        });
      } catch (e) {
        if (isBucketMissing(e)) {
          throw new Error(
            `Supabase Storage bucket not found. Create a bucket named '${preferredBucket}' (recommended) ` +
              `or '${fallbackBucket}' in Supabase Dashboard → Storage, then try again.`,
          );
        }
        throw e;
      }
    }

    return uploaded;
  }

  async function upsertGig({ status }) {
    const title = gigForm.title.trim();
    if (!title) return;

    try {
      const uid = userUid || auth.currentUser?.uid || "";
      const gigId = gigForm.editingGigId || `gig-${Date.now()}`;

      const selectedFiles = (gigForm.images || [])
        .map((img) => img?.file)
        .filter(Boolean);

      // Upload new files (if any), otherwise preserve existing cover image when editing.
      const uploadedFiles = selectedFiles.length
        ? await uploadGigImages({ gigId, files: selectedFiles })
        : [];

      const existingGig = gigForm.editingGigId ? getStoredGig(gigForm.editingGigId) : null;

      const coverUpload = uploadedFiles?.[0] || null;
      const coverBucket = String(coverUpload?.bucket || existingGig?.cover_bucket || "").trim();
      const coverPath = String(coverUpload?.path || existingGig?.cover_path || "").trim();

      const coverUrl = (await resolveGigCoverUrl({
        cover_image_url: String(coverUpload?.publicUrl || existingGig?.cover_image_url || ""),
        cover_bucket: coverBucket,
        cover_path: coverPath,
      }).catch(() => null)) || "";

      // Update previews to use the real URLs (so the UI stays consistent after upload).
      if (uploadedFiles.length) {
        const previewUrls = await Promise.all(
          uploadedFiles.map(async (f) => {
            const url = await resolveGigCoverUrl({
              cover_image_url: String(f?.publicUrl || ""),
              cover_bucket: String(f?.bucket || ""),
              cover_path: String(f?.path || ""),
            }).catch(() => null);
            return url || "";
          }),
        );

        setGigForm((p) => ({
          ...p,
          images: previewUrls.filter(Boolean).map((url) => ({ file: null, previewUrl: url })),
        }));
      }

      if (gigForm.editingGigId) {
        setGigs((prev) =>
          prev.map((g) =>
            g.id === gigForm.editingGigId
              ? {
                  ...g,
                  title,
                  status,
                  thumbnailUrl: coverUrl,
                }
              : g,
          ),
        );

        const storedGig = {
          gig_id: gigId,
          title,
          category: gigForm.category,
          subcategory: gigForm.subcategory,
          revisions: Number(gigForm.revisions) || 0,
          tags: gigForm.tags || "",
          cover_image_url: String(coverUpload?.publicUrl || existingGig?.cover_image_url || ""),
          cover_bucket: coverBucket,
          cover_path: coverPath,
          seller_id: uid,
          description_html: gigForm.descriptionHtml || "",
          services: [
            {
              service_id: `${gigId}:basic`,
              name: "Basic",
              price: Number(gigForm.priceBasic) || 0,
              delivery_time_days: Number(gigForm.deliveryTimeDays) || 1,
            },
            {
              service_id: `${gigId}:standard`,
              name: "Standard",
              price: Number(gigForm.priceStandard) || 0,
              delivery_time_days: Number(gigForm.deliveryTimeDays) || 1,
            },
            {
              service_id: `${gigId}:premium`,
              name: "Premium",
              price: Number(gigForm.pricePremium) || 0,
              delivery_time_days: Number(gigForm.deliveryTimeDays) || 1,
            },
          ],
        };

        upsertStoredGig(storedGig);

        // Best-effort: persist the gig to Firestore so it shows in the marketplace for everyone.
        if (uid) {
          try {
            await upsertFirestoreGig(db, storedGig);
          } catch (e) {
            console.error("Failed to write Firestore gig", e);
          }
        }

        // Best-effort: also persist services to Firestore for the report-required Services Collection.
        if (uid) {
          try {
            await upsertFirestoreServices({
              db,
              freelancerId: uid,
              gigTitle: storedGig.title,
              gigDescription: storedGig.description_html,
              category: storedGig.category,
              services: storedGig.services,
            });
          } catch (e) {
            console.error("Failed to write Firestore services", e);
            toast({
              title: "Firestore sync failed",
              description: e?.message || "Could not write services to Firestore. Check rules/auth and try again.",
              variant: "destructive",
            });
          }
        }
      } else {
        const newGig = {
          id: gigId,
          title,
          thumbnailUrl: coverUrl,
          status,
          impressions: 0,
          clicks: 0,
          orders: 0,
          sellerId: uid,
        };
        setGigs((prev) => [newGig, ...prev]);
        setSelectedGigId(newGig.id);

        const storedGig = {
          gig_id: gigId,
          title,
          category: gigForm.category,
          subcategory: gigForm.subcategory,
          revisions: Number(gigForm.revisions) || 0,
          tags: gigForm.tags || "",
          cover_image_url: String(coverUpload?.publicUrl || ""),
          cover_bucket: coverBucket,
          cover_path: coverPath,
          seller_id: uid,
          description_html: gigForm.descriptionHtml || "",
          services: [
            {
              service_id: `${gigId}:basic`,
              name: "Basic",
              price: Number(gigForm.priceBasic) || 0,
              delivery_time_days: Number(gigForm.deliveryTimeDays) || 1,
            },
            {
              service_id: `${gigId}:standard`,
              name: "Standard",
              price: Number(gigForm.priceStandard) || 0,
              delivery_time_days: Number(gigForm.deliveryTimeDays) || 1,
            },
            {
              service_id: `${gigId}:premium`,
              name: "Premium",
              price: Number(gigForm.pricePremium) || 0,
              delivery_time_days: Number(gigForm.deliveryTimeDays) || 1,
            },
          ],
        };

        upsertStoredGig(storedGig);

        // Best-effort: persist the gig to Firestore so it shows in the marketplace for everyone.
        if (uid) {
          try {
            await upsertFirestoreGig(db, storedGig);
          } catch (e) {
            console.error("Failed to write Firestore gig", e);
          }
        }

        // Best-effort: also persist services to Firestore for the report-required Services Collection.
        if (uid) {
          try {
            await upsertFirestoreServices({
              db,
              freelancerId: uid,
              gigTitle: storedGig.title,
              gigDescription: storedGig.description_html,
              category: storedGig.category,
              services: storedGig.services,
            });
          } catch (e) {
            console.error("Failed to write Firestore services", e);
            toast({
              title: "Firestore sync failed",
              description: e?.message || "Could not write services to Firestore. Check rules/auth and try again.",
              variant: "destructive",
            });
          }
        }

        setGigForm((p) => ({ ...p, editingGigId: gigId }));
      }
    } catch (err) {
      toast({
        title: "Gig upload failed",
        description:
          err?.message ??
          "Make sure the Supabase Storage bucket 'gig-images' exists and is public (or switch to signed URLs).",
        variant: "destructive",
      });
    }

    resetGigForm();
  }

  function startEditGig(gig) {
    setOpenSection("gigs");
    const stored = getStoredGig(gig?.id);

    function pickService(tier) {
      const services = stored?.services;
      if (!Array.isArray(services)) return null;

      return (
        services.find((s) => String(s?.service_id || "").endsWith(`:${tier}`)) ||
        services.find((s) => String(s?.name || "").toLowerCase() === tier) ||
        null
      );
    }

    const basic = pickService("basic");
    const standard = pickService("standard");
    const premium = pickService("premium");

    const nextCategory = stored?.category || CATEGORY_OPTIONS[0].category;
    const nextSubcategoryOptions = CATEGORY_OPTIONS.find((c) => c.category === nextCategory)?.subcategories ?? [];
    const nextSubcategory = nextSubcategoryOptions.includes(stored?.subcategory)
      ? stored.subcategory
      : nextSubcategoryOptions[0] ?? "";

    setGigForm((prev) => ({
      ...prev,
      editingGigId: gig.id,
      title: stored?.title || gig.title,
      category: nextCategory,
      subcategory: nextSubcategory,
      priceBasic: Number(basic?.price ?? prev.priceBasic) || 0,
      priceStandard: Number(standard?.price ?? prev.priceStandard) || 0,
      pricePremium: Number(premium?.price ?? prev.pricePremium) || 0,
      deliveryTimeDays: Number(basic?.delivery_time_days ?? prev.deliveryTimeDays) || 1,
      revisions: Number(stored?.revisions ?? prev.revisions) || 0,
      descriptionHtml: stored?.description_html || prev.descriptionHtml,
      tags: String(stored?.tags ?? prev.tags ?? ""),
      images: [],
    }));

    requestAnimationFrame(() => {
      gigFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const el = document.getElementById("gig-title");
      if (el && typeof el.focus === "function") el.focus();
    });
  }

  function togglePauseGig(gigId) {
    setGigs((prev) =>
      prev.map((g) => {
        if (g.id !== gigId) return g;
        if (g.status === "Draft") return g;
        return { ...g, status: g.status === "Paused" ? "Active" : "Paused" };
      }),
    );
  }

  function deleteGig(gigId) {
    const ok = window.confirm("Delete this gig?");
    if (!ok) return;
    setGigs((prev) => prev.filter((g) => g.id !== gigId));
    removeStoredGig(gigId);
    if (selectedGigId === gigId) {
      setSelectedGigId((prev) => {
        const remaining = gigs.filter((g) => g.id !== gigId);
        return remaining[0]?.id ?? prev;
      });
    }
  }

  useEffect(() => {
    async function hydrateThumbnails() {
      const next = [];
      for (const g of gigs) {
        if (g?.thumbnailUrl) {
          next.push(g);
          continue;
        }

        const stored = getStoredGig(g?.id);
        const signed = stored
          ? await resolveGigCoverUrl(stored).catch(() => null)
          : null;

        next.push({
          ...g,
          thumbnailUrl: signed || g.thumbnailUrl || "",
        });
      }

      setGigs(next);
    }

    // Only run when we have items (avoid clobbering initial empty state).
    if (!Array.isArray(gigs) || !gigs.length) return;
    hydrateThumbnails().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gigs.length]);

  function promoteGig(gigId) {
    if (!gigId) return;
    if (!proActive) {
      toast({
        title: "Pro required",
        description: "Upgrade to Pro to promote your gig and boost ranking.",
        variant: "destructive",
      });
      return;
    }

    const stored = getStoredGig(gigId);
    if (!stored) return;

    upsertStoredGig({
      ...stored,
      promoted: true,
      promoted_at: new Date().toISOString(),
    });

    setGigs((prev) => prev.map((g) => (g.id === gigId ? { ...g, promoted: true } : g)));
    toast({ title: "Gig promoted", description: "Your gig will rank higher in listings." });
  }

  function openGig(gigId) {
    if (!gigId) return;
    navigate(`/gig/${encodeURIComponent(gigId)}`);
  }

  function viewGigAnalytics(gigId) {
    setSelectedGigId(gigId);
    scrollToAnalytics();
  }

  function goToWithdrawalDetails() {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (amount > earnings.available) {
      toast({
        title: "Insufficient balance",
        description: `Available: ${formatCurrency(earnings.available)}`,
        variant: "destructive",
      });
      return;
    }
    if (hasPendingWithdrawal) {
      toast({
        title: "Withdrawal already in progress",
        description: "Please wait for the current withdrawal to complete.",
        variant: "destructive",
      });
      return;
    }
    navigate("/withdrawal", { state: { amount, available: earnings.available } });
  }

  return (
    <>
      <Helmet>
        <title>Freelancer Dashboard - GigFlow</title>
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 space-y-8 leading-relaxed">
          <header className="space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-foreground">Freelancer Dashboard</h1>
              <Button variant="outline" onClick={switchToClientDashboard}>
                Switch to client dashboard
              </Button>
            </div>
            <p className="text-muted-foreground">
              {userEmail ? (
                <>
                  Signed in as <span className="font-medium text-foreground">{userEmail}</span>
                </>
              ) : (
                "Loading account…"
              )}
            </p>
          </header>

          {/* Overview */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xl font-semibold">Overview</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Earnings (Today)</CardDescription>
                  <CardTitle className="text-2xl">{formatCurrency(overview.todayEarnings)}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Earnings (Month)</CardDescription>
                  <CardTitle className="text-2xl">{formatCurrency(overview.monthEarnings)}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Earnings (Total)</CardDescription>
                  <CardTitle className="text-2xl">{formatCurrency(overview.totalEarnings)}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Orders</CardDescription>
                  <CardTitle className="text-2xl">{overview.activeOrdersCount}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Gig Impressions</CardDescription>
                  <CardTitle className="text-2xl">{overview.gigImpressions.toLocaleString()}</CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Profile Completion</CardDescription>
                  <CardTitle className="text-2xl">{profileCompletion}%</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={profileCompletion} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pro Subscription</CardDescription>
                <CardTitle className="text-2xl">
                  {proLoading ? "Checking…" : proActive ? "Active" : "Inactive"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-muted-foreground">
                  Pay ₹800 to get a Pro badge + Verified badge, higher ranking, and the Promote option.
                  {proEndsAt ? ` Active until ${new Date(proEndsAt).toLocaleDateString()}.` : ""}
                </div>
                <Button onClick={upgradeToPro} disabled={upgradingPro || proActive}>
                  {proActive ? "Pro Enabled" : upgradingPro ? "Processing…" : "Upgrade ₹800"}
                </Button>
              </CardContent>
            </Card>
          </section>

          <Separator />

          <Accordion
            type="single"
            collapsible
            value={openSection ?? undefined}
            onValueChange={(v) => setOpenSection(v || null)}
            className="space-y-3"
          >
            <AccordionItem value="gigs" className="border-b-0 border border-border rounded-2xl bg-card overflow-hidden">
              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-surface/60 transition-colors">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-base font-semibold">Gigs</span>
                  <span className="text-sm text-muted-foreground">Manage and create gigs</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-6 pt-4 text-base">
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {gigs.map((gig) => (
                      <Card
                        key={`card-${gig.id}`}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => openGig(gig.id)}
                      >
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            {gig.thumbnailUrl ? (
                              <img
                                src={gig.thumbnailUrl}
                                alt={gig.title}
                                className="h-32 w-full rounded-md object-cover border"
                              />
                            ) : (
                              <div className="h-32 w-full rounded-md border bg-muted" />
                            )}
                            <div className="font-medium line-clamp-2">{gig.title}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardContent className="pt-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Gig</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Impressions</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                            <TableHead className="text-right">Orders</TableHead>
                            <TableHead className="text-right">Conversion</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gigs.map((gig) => {
                            const conv = conversionRate({ clicks: gig.clicks, orders: gig.orders });
                            return (
                              <TableRow key={gig.id}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    {gig.thumbnailUrl ? (
                                      <img
                                        src={gig.thumbnailUrl}
                                        alt="Gig thumbnail"
                                        className="h-10 w-16 rounded-md object-cover border"
                                      />
                                    ) : (
                                      <div className="h-10 w-16 rounded-md border bg-muted" />
                                    )}
                                    <div className="min-w-0">
                                      <div className="font-medium truncate max-w-[360px]">{gig.title}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={statusBadgeVariant(gig.status)}>{gig.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right">{gig.impressions.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{gig.clicks.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{gig.orders.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{conv.toFixed(1)}%</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2 flex-wrap">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      disabled={!proActive}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        promoteGig(gig.id);
                                      }}
                                    >
                                      Promote
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startEditGig(gig);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={gig.status === "Draft"}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        togglePauseGig(gig.id);
                                      }}
                                    >
                                      {gig.status === "Paused" ? "Unpause" : "Pause"}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteGig(gig.id);
                                      }}
                                    >
                                      Delete
                                    </Button>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        viewGigAnalytics(gig.id);
                                      }}
                                    >
                                      View Analytics
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold">Create gig</h3>
                      <p className="text-sm text-muted-foreground">Draft or publish a new listing</p>
                    </div>
                    {gigForm.editingGigId ? <Badge variant="secondary">Editing {gigForm.editingGigId}</Badge> : null}
                  </div>

                  <Card>
                    <CardContent ref={gigFormRef} className="pt-6 space-y-6 md:space-y-8">
                      <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 md:p-6 space-y-6">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold leading-tight">Basics</h4>
                          <p className="text-xs text-muted-foreground">
                            Start with a clear title, then use a keyword to generate a stronger title and description.
                          </p>
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="gig-title">Gig title</Label>
                            <div className="grid gap-3">
                              <Input
                                id="gig-title"
                                value={gigForm.title}
                                onChange={(e) => setGigForm((p) => ({ ...p, title: e.target.value }))}
                                placeholder="e.g. I will design a modern logo"
                              />
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <Input
                                  value={aiTitleKeyword}
                                  onChange={(e) => setAiTitleKeyword(e.target.value)}
                                  placeholder="Keyword (e.g. video editing)"
                                  className="sm:flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={generateTitleAi}
                                  disabled={aiTitleLoading}
                                  className="sm:w-auto sm:min-w-[220px]"
                                >
                                  {aiTitleLoading ? "Generating…" : "Generate Title + Description"}
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Category</Label>
                              <Select value={gigForm.category} onValueChange={handleCategoryChange}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORY_OPTIONS.map((c) => (
                                    <SelectItem key={c.category} value={c.category}>
                                      {c.category}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Subcategory</Label>
                              <Select
                                value={gigForm.subcategory}
                                onValueChange={(v) => setGigForm((p) => ({ ...p, subcategory: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select subcategory" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(CATEGORY_OPTIONS.find((c) => c.category === gigForm.category)?.subcategories ?? []).map(
                                    (s) => (
                                      <SelectItem key={s} value={s}>
                                        {s}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 md:p-6 space-y-6">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold leading-tight">Pricing</h4>
                          <p className="text-xs text-muted-foreground">Set simple tiered pricing for your service.</p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-xl border bg-background p-4 space-y-2">
                            <Label className="text-xs text-muted-foreground">Basic</Label>
                            <Input
                              type="number"
                              value={gigForm.priceBasic}
                              onChange={(e) => setGigForm((p) => ({ ...p, priceBasic: Number(e.target.value) }))}
                            />
                          </div>
                          <div className="rounded-xl border bg-background p-4 space-y-2">
                            <Label className="text-xs text-muted-foreground">Standard</Label>
                            <Input
                              type="number"
                              value={gigForm.priceStandard}
                              onChange={(e) => setGigForm((p) => ({ ...p, priceStandard: Number(e.target.value) }))}
                            />
                          </div>
                          <div className="rounded-xl border bg-background p-4 space-y-2">
                            <Label className="text-xs text-muted-foreground">Premium</Label>
                            <Input
                              type="number"
                              value={gigForm.pricePremium}
                              onChange={(e) => setGigForm((p) => ({ ...p, pricePremium: Number(e.target.value) }))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 md:p-6 space-y-6">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold leading-tight">Delivery</h4>
                          <p className="text-xs text-muted-foreground">Set expectations for delivery and revisions.</p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Delivery time</Label>
                            <Select
                              value={String(gigForm.deliveryTimeDays)}
                              onValueChange={(v) => setGigForm((p) => ({ ...p, deliveryTimeDays: Number(v) }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 5, 7, 10, 14].map((d) => (
                                  <SelectItem key={d} value={String(d)}>
                                    {d} day{d === 1 ? "" : "s"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Revisions</Label>
                            <Select
                              value={String(gigForm.revisions)}
                              onValueChange={(v) => setGigForm((p) => ({ ...p, revisions: Number(v) }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 1, 2, 3, 5, 10].map((r) => (
                                  <SelectItem key={r} value={String(r)}>
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 md:p-6 space-y-6">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold leading-tight">Description</h4>
                          <p className="text-xs text-muted-foreground">Explain what you’ll deliver and what you need from the buyer.</p>
                        </div>

                        <div className="space-y-2">
                          <Label>Gig description (rich text)</Label>
                          <div
                            className="min-h-[160px] rounded-md border border-input bg-background px-3 py-3 text-sm leading-relaxed focus-within:ring-2 focus-within:ring-ring"
                            key={gigForm.editingGigId || "new"}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(e) => setGigForm((p) => ({ ...p, descriptionHtml: e.currentTarget.innerHTML }))}
                            dangerouslySetInnerHTML={{ __html: gigForm.descriptionHtml }}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 md:p-6 space-y-6">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold leading-tight">Details</h4>
                          <p className="text-xs text-muted-foreground">Add tags and images to help buyers understand your gig.</p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Tags</Label>
                            <Input
                              value={gigForm.tags}
                              onChange={(e) => setGigForm((p) => ({ ...p, tags: e.target.value }))}
                              placeholder="e.g. logo, branding, minimal"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Gig images upload</Label>
                            <Input
                              type="file"
                              multiple
                              accept="image/*"
                              onChange={(e) => {
                                const input = e.currentTarget;
                                const files = Array.from(input.files ?? []);
                                const withPreview = files
                                  .filter(Boolean)
                                  .map((f) => ({
                                    file: f,
                                    previewUrl: URL.createObjectURL(f),
                                    name: f.name,
                                  }));

                                setGigForm((p) => ({ ...p, images: withPreview }));

                                // Allow selecting the same file(s) again to re-trigger onChange.
                                input.value = "";
                              }}
                            />
                            {gigForm.images?.length ? (
                              <div className="flex gap-3 flex-wrap pt-1">
                                {gigForm.images.slice(0, 6).map((img) => (
                                  <img
                                    key={img.previewUrl}
                                    src={img.previewUrl}
                                    alt="Gig upload"
                                    className="h-16 w-24 rounded-md object-cover border"
                                  />
                                ))}
                              </div>
                            ) : null}
                            {gigForm.images?.length ? (
                              <div className="text-xs text-muted-foreground">
                                Selected {gigForm.images.length} file(s)
                                {gigForm.images?.[0]?.name ? `: ${gigForm.images.slice(0, 3).map((i) => i.name).join(", ")}${gigForm.images.length > 3 ? "…" : ""}` : ""}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end pt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            upsertGig({ status: "Draft" }).catch((e) => console.error("Save draft failed", e));
                          }}
                        >
                          Save as Draft
                        </Button>
                        <Button
                          onClick={() => {
                            upsertGig({ status: "Active" }).catch((e) => console.error("Publish failed", e));
                          }}
                        >
                          Publish
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem ref={analyticsRef} value="analytics" className="border-b-0 border border-border rounded-2xl bg-card overflow-hidden">
              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-surface/60 transition-colors">
                <div className="flex flex-col items-start">
                  <span className="text-base font-semibold">Analytics</span>
                  <span className="text-sm text-muted-foreground">Impressions, clicks, orders, earnings</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-6 pt-0 text-base">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select value={selectedGigId} onValueChange={(v) => setSelectedGigId(v)}>
                        <SelectTrigger className="w-full sm:w-[280px]">
                          <SelectValue placeholder="Select gig" />
                        </SelectTrigger>
                        <SelectContent>
                          {gigs.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Tabs value={analyticsDays} onValueChange={setAnalyticsDays}>
                        <TabsList>
                          <TabsTrigger value="7">7 days</TabsTrigger>
                          <TabsTrigger value="30">30 days</TabsTrigger>
                          <TabsTrigger value="90">90 days</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Impressions</CardTitle>
                        <CardDescription>{selectedGig?.title ?? ""}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer
                          config={{ impressions: { label: "Impressions", color: "hsl(var(--primary))" } }}
                          className="h-[220px] w-full"
                        >
                          <RechartsPrimitive.AreaChart data={analyticsSeries} margin={{ left: 8, right: 8 }}>
                            <RechartsPrimitive.CartesianGrid vertical={false} />
                            <RechartsPrimitive.XAxis dataKey="day" tickLine={false} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            <RechartsPrimitive.Area
                              type="monotone"
                              dataKey="impressions"
                              stroke="var(--color-impressions)"
                              fill="var(--color-impressions)"
                              fillOpacity={0.2}
                            />
                          </RechartsPrimitive.AreaChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Clicks</CardTitle>
                        <CardDescription>{selectedGig?.title ?? ""}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={{ clicks: { label: "Clicks", color: "hsl(var(--primary))" } }} className="h-[220px] w-full">
                          <RechartsPrimitive.AreaChart data={analyticsSeries} margin={{ left: 8, right: 8 }}>
                            <RechartsPrimitive.CartesianGrid vertical={false} />
                            <RechartsPrimitive.XAxis dataKey="day" tickLine={false} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            <RechartsPrimitive.Area
                              type="monotone"
                              dataKey="clicks"
                              stroke="var(--color-clicks)"
                              fill="var(--color-clicks)"
                              fillOpacity={0.2}
                            />
                          </RechartsPrimitive.AreaChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Orders</CardTitle>
                        <CardDescription>{selectedGig?.title ?? ""}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer config={{ orders: { label: "Orders", color: "hsl(var(--primary))" } }} className="h-[220px] w-full">
                          <RechartsPrimitive.AreaChart data={analyticsSeries} margin={{ left: 8, right: 8 }}>
                            <RechartsPrimitive.CartesianGrid vertical={false} />
                            <RechartsPrimitive.XAxis dataKey="day" tickLine={false} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            <RechartsPrimitive.Area
                              type="monotone"
                              dataKey="orders"
                              stroke="var(--color-orders)"
                              fill="var(--color-orders)"
                              fillOpacity={0.2}
                            />
                          </RechartsPrimitive.AreaChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Earnings</CardTitle>
                        <CardDescription>{selectedGig?.title ?? ""}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChartContainer
                          config={{ earnings: { label: "Earnings", color: "hsl(var(--primary))" } }}
                          className="h-[220px] w-full"
                        >
                          <RechartsPrimitive.AreaChart data={analyticsSeries} margin={{ left: 8, right: 8 }}>
                            <RechartsPrimitive.CartesianGrid vertical={false} />
                            <RechartsPrimitive.XAxis dataKey="day" tickLine={false} axisLine={false} />
                            <ChartTooltip
                              content={
                                <ChartTooltipContent
                                  formatter={(value, name) => {
                                    if (name === "earnings") {
                                      return (
                                        <div className="flex w-full justify-between gap-4">
                                          <span className="text-muted-foreground">Earnings</span>
                                          <span className="font-mono font-medium tabular-nums text-foreground">
                                            {formatCurrency(Number(value))}
                                          </span>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="flex w-full justify-between gap-4">
                                        <span className="text-muted-foreground">{name}</span>
                                        <span className="font-mono font-medium tabular-nums text-foreground">
                                          {Number(value).toLocaleString()}
                                        </span>
                                      </div>
                                    );
                                  }}
                                />
                              }
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            <RechartsPrimitive.Area
                              type="monotone"
                              dataKey="earnings"
                              stroke="var(--color-earnings)"
                              fill="var(--color-earnings)"
                              fillOpacity={0.2}
                            />
                          </RechartsPrimitive.AreaChart>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="orders" className="border-b-0 border border-border rounded-2xl bg-card overflow-hidden">
              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-surface/60 transition-colors">
                <div className="flex flex-col items-start">
                  <span className="text-base font-semibold">Order management</span>
                  <span className="text-sm text-muted-foreground">Active, delivered, late orders</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-6 pt-0 text-base">
                <Card>
                  <CardContent className="pt-6">
                    <Tabs defaultValue="active">
                      <TabsList>
                        <TabsTrigger value="active">Active orders</TabsTrigger>
                        <TabsTrigger value="delivered">Delivered orders</TabsTrigger>
                        <TabsTrigger value="late">Late orders</TabsTrigger>
                      </TabsList>

                      {(
                        [
                          ["active", ordersDerived.active],
                          ["delivered", ordersDerived.delivered],
                          ["late", ordersDerived.late],
                        ]
                      ).map(([key, list]) => (
                        <TabsContent key={key} value={key}>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Buyer</TableHead>
                                <TableHead className="text-right">Order amount</TableHead>
                                <TableHead>Deadline</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {list.length ? (
                                list.map((o) => (
                                  <TableRow key={o.id}>
                                    <TableCell className="font-medium">
                                      {o.clientId ? `${o.clientId.slice(0, 8)}…` : "—"}
                                    </TableCell>
                                    <TableCell className="text-right">{formatInr(o.amountRupees)}</TableCell>
                                    <TableCell>
                                      {o.deadlineISO
                                        ? new Date(o.deadlineISO).toLocaleDateString(undefined, {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                          })
                                        : "—"}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={o.status === "Delivered" ? "secondary" : "default"}>
                                        {key === "late" ? "Late" : o.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => navigate(`/orders/${o.id}/chat`)}
                                        >
                                          Open
                                        </Button>
                                        {(o.orderStatus === "In Progress" || o.orderStatus === "Revision") && (
                                          <Button size="sm" onClick={() => navigate(`/orders/${o.id}/chat`)}>
                                            Deliver
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-muted-foreground">
                                    No orders
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem ref={withdrawalsRef} value="withdrawals" className="border-b-0 border border-border rounded-2xl bg-card overflow-hidden">
              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-surface/60 transition-colors">
                <div className="flex flex-col items-start">
                  <span className="text-base font-semibold">Withdrawals</span>
                  <span className="text-sm text-muted-foreground">Balance and withdrawal history</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-6 pt-0 text-base">
                <div className="space-y-4">
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <CardTitle className="text-base">Demo mode</CardTitle>
                          <CardDescription>
                            Toggle RazorpayX-like withdrawals simulation (hosted in Supabase) without rebuilding.
                          </CardDescription>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">Use Supabase demo</span>
                          <Switch checked={useDemoWithdrawals} onCheckedChange={applyWithdrawalsApiToggle} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="md:col-span-2 space-y-2">
                          <Label>How it works</Label>
                          <div className="text-sm text-muted-foreground">
                            Demo withdrawals start as <span className="font-medium">Processing</span> and flip to
                            <span className="font-medium"> Completed</span> or <span className="font-medium">Failed</span>
                            automatically while the table polls.
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Current source</Label>
                          <div className="h-10 flex items-center">
                            <Badge variant="secondary">
                              {useDemoWithdrawals ? "Supabase demo" : "Supabase"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tip: Request a withdrawal to see it complete or fail automatically.
                      </p>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Available balance</CardDescription>
                        <CardTitle className="text-2xl">{formatCurrency(earnings.available)}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="withdraw-amount">Withdraw amount</Label>
                          <Input
                            id="withdraw-amount"
                            type="number"
                            min={1}
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                          />
                        </div>
                        <Button
                          onClick={goToWithdrawalDetails}
                          disabled={withdrawalsLoading || hasPendingWithdrawal || withdrawAmount > earnings.available}
                        >
                          Withdraw
                        </Button>
                        {hasPendingWithdrawal ? (
                          <p className="text-xs text-muted-foreground">
                            You have a withdrawal in progress.
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Pending clearance</CardDescription>
                        <CardTitle className="text-2xl">{formatCurrency(earnings.pendingClearance)}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">Pending withdrawals.</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>Total earnings</CardDescription>
                        <CardTitle className="text-2xl">{formatCurrency(earnings.gross)}</CardTitle>
                      </CardHeader>
                      <CardContent />
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Withdraw history</CardTitle>
                      <CardDescription>Most recent first</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {withdrawalsLoading ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-muted-foreground">
                                Loading...
                              </TableCell>
                            </TableRow>
                          ) : withdrawals.length ? (
                            withdrawals.map((w) => {
                              const badge = withdrawalStatusBadge(w.status);
                              return (
                                <TableRow key={w.id}>
                                  <TableCell>
                                    {new Date(w.dateISO).toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </TableCell>
                                  <TableCell className="text-right">{formatCurrency(w.amount)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={badge.className}>
                                      {badge.label}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-muted-foreground">
                                No withdrawals yet
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </main>
        <Footer />
      </div>
    </>
  );
}
