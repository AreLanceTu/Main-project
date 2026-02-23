import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Timestamp, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { auth, db } from "@/firebase";
import { getStoredGig, upsertStoredGig } from "@/lib/gigStore";
import { DEMO_GIG_IDS } from "@/lib/demoGigs";
import { getDemoSellerUid } from "@/lib/demoSeller";
import { resolveGigCoverUrl } from "@/lib/gigCovers";
import { getFirestoreGig } from "@/lib/firestoreGigs";
import { openRazorpayCheckout, verifyRazorpayPayment } from "@/lib/payments";
import { storePaymentInFirestore } from "@/lib/paymentFirestore";
import { useToast } from "@/hooks/use-toast";

type StoredService = {
  service_id: string;
  name: string;
  price: number;
  delivery_time_days: number;
  features?: string[];
};

type StoredGig = {
  gig_id: string;
  title: string;
  cover_image_url: string;
  cover_bucket?: string;
  cover_path?: string;
  seller_id: string;
  description_html?: string;
  services?: StoredService[];
};

export default function Checkout() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const gigId = params.get("gigId") || "";
  const serviceId = params.get("serviceId") || "";

  const [paying, setPaying] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(() => auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const demoSellerUid = useMemo(() => getDemoSellerUid(), []);

  const [gig, setGig] = useState<StoredGig | null>(() => getStoredGig(gigId) as StoredGig | null);
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string>(gig?.cover_image_url || "");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const id = String(gigId || "").trim();
      if (!id) {
        if (!cancelled) setGig(null);
        return;
      }

      const fromLocal = (getStoredGig(id) as StoredGig | null) || null;
      if (fromLocal) {
        if (!cancelled) setGig(fromLocal);
        return;
      }

      try {
        const fromFs = await getFirestoreGig(db, id);
        if (!cancelled) setGig((fromFs as any) || null);
      } catch {
        if (!cancelled) setGig(null);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [gigId]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!gig) {
        if (!cancelled) setResolvedCoverUrl("");
        return;
      }
      const url = await resolveGigCoverUrl(gig).catch(() => null);
      if (!cancelled) setResolvedCoverUrl(url || String(gig.cover_image_url || ""));
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [gig?.gig_id]);

  useEffect(() => {
    if (!demoSellerUid) return;
    const id = String(gigId || "");
    if (!id) return;
    if (!DEMO_GIG_IDS.includes(id)) return;

    const existing = getStoredGig(id) as StoredGig | null;
    if (!existing) return;
    if (String(existing?.seller_id || "") === String(demoSellerUid)) return;

    const patched = { ...existing, seller_id: String(demoSellerUid) };
    upsertStoredGig(patched);
    setGig(patched);
  }, [demoSellerUid, gigId]);

  const service = useMemo(() => {
    const list = gig?.services || [];
    return list.find((s) => String(s?.service_id) === String(serviceId)) || null;
  }, [gig?.services, serviceId]);

  useEffect(() => {
    if (!user) {
      setBlockedReason("You must be logged in to purchase.");
      return;
    }
    if (gig && String(gig.seller_id) === String(user.uid)) {
      setBlockedReason("You cannot purchase your own gig.");
      return;
    }
    setBlockedReason(null);
  }, [gig, user]);

  async function pay() {
    if (paying) return;
    if (!gig || !service) return;

    if (!user) {
      toast({
        title: "Not signed in",
        description: "Please log in to continue.",
        variant: "destructive",
      });
      return;
    }

    if (String(gig.seller_id) === String(user.uid)) {
      toast({
        title: "Purchase blocked",
        description: "You cannot purchase your own gig.",
        variant: "destructive",
      });
      return;
    }

    try {
      setPaying(true);

      const amountRupees = Number(service.price);
      if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
        throw new Error("Invalid service price");
      }

      const { orderId, paymentId, signature } = await openRazorpayCheckout({
        amountRupees,
        purpose: `Gig purchase: ${gig.title} (${service.name})`,
        prefill: { email: user.email || undefined },
        notes: {
          gig_id: gig.gig_id,
          service_id: service.service_id,
          seller_id: gig.seller_id,
          buyer_id: user.uid,
        },
      });

      const verify = await verifyRazorpayPayment({
        orderId,
        paymentId,
        signature,
      });

      if (!verify?.ok) {
        throw new Error(verify?.error || "Payment verification failed");
      }

      // Create an order record in Firestore (Orders Collection) for the report-required schema.
      // This is best-effort and should not block a successful payment flow.
      let firestoreOrderId: string | null = null;
      try {
        const deliveryTimeDays = Math.max(1, Number(service.delivery_time_days || 3));
        const dueAt = Timestamp.fromDate(new Date(Date.now() + deliveryTimeDays * 24 * 60 * 60 * 1000));

        const revisionLimit = (() => {
          const explicit = Number((service as any)?.revisions);
          if (Number.isFinite(explicit) && explicit >= 0) return explicit;

          const feats = Array.isArray((service as any)?.features) ? (service as any).features : [];
          for (const f of feats) {
            const s = String(f || "").toLowerCase();
            if (!s.includes("revision")) continue;
            if (s.includes("unlimited")) return 99;
            const m = s.match(/(\d+)/);
            if (m) {
              const n = Number(m[1]);
              if (Number.isFinite(n) && n >= 0) return n;
            }
          }
          return 2;
        })();

        const orderRef = doc(collection(db, "orders"));
        firestoreOrderId = orderRef.id;
        await setDoc(orderRef, {
          orderId: orderRef.id,
          clientId: user.uid,
          serviceId: service.service_id,
          paymentStatus: "Paid",
          orderStatus: "Pending",
          createdAt: serverTimestamp(),

          // Workflow defaults
          requirementsSubmitted: false,
          revisionLimit,
          revisionCount: 0,
          deliveryTimeDays,
          dueAt,

          // Optional metadata (helps debugging / traceability).
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          gigId: gig.gig_id,
          sellerId: gig.seller_id,
          amountRupees,
        });
      } catch (writeErr) {
        // eslint-disable-next-line no-console
        console.error("Failed to write Firestore order", writeErr);
        toast({
          title: "Order created, but saving failed",
          description:
            "Payment succeeded, but we couldn't save the order in Firestore (permissions). If you just updated rules, deploy them and retry.",
          variant: "destructive",
        });
      }

      // Store payment details in Firestore (Payments Collection).
      // Best-effort: don't block a successful payment flow.
      try {
        await storePaymentInFirestore({
          paymentId,
          orderId,
          amountRupees,
          currency: "INR",
          purpose: `Gig purchase: ${gig.title} (${service.name})`,
          status: "Paid",
          quantityTotal: 1,
          quantityUsed: 0,
          notes: {
            gig_id: gig.gig_id,
            service_id: service.service_id,
            seller_id: gig.seller_id,
            buyer_id: user.uid,
          },
          related: {
            gigId: gig.gig_id,
            serviceId: service.service_id,
            sellerId: gig.seller_id,
            firestoreOrderId: firestoreOrderId || "",
          },
        });
      } catch (writeErr) {
        // eslint-disable-next-line no-console
        console.error("Failed to write Firestore payment", writeErr);
      }

      navigate(
        `/order-confirmation?gigId=${encodeURIComponent(gig.gig_id)}&serviceId=${encodeURIComponent(service.service_id)}&paymentId=${encodeURIComponent(paymentId)}&sellerId=${encodeURIComponent(gig.seller_id)}&firestoreOrderId=${encodeURIComponent(firestoreOrderId || "")}`,
      );
    } catch (e: any) {
      toast({
        title: "Payment failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Checkout - GigFlow</title>
        <meta name="description" content="Checkout" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />

        <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-10">
          <div className="max-w-2xl mx-auto space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Checkout</CardTitle>
                <CardDescription>Confirm your selected package and pay securely.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!gig ? (
                  <div className="text-sm text-muted-foreground">Gig not found.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium">{gig.title}</div>
                        <div className="text-sm text-muted-foreground">Gig ID: {gig.gig_id}</div>
                      </div>
                      {gig.cover_image_url ? (
                        <img
                          src={resolvedCoverUrl || gig.cover_image_url}
                          alt={gig.title}
                          className="h-12 w-20 rounded-md object-cover border"
                        />
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="max-w-full break-all">
                        Seller: {gig.seller_id}
                      </Badge>
                      <Badge variant="outline" className="max-w-full break-all">
                        Buyer: {user?.uid || ""}
                      </Badge>
                    </div>

                    {!service ? (
                      <div className="text-sm text-muted-foreground">Service not found.</div>
                    ) : (
                      <div className="rounded-lg border border-border p-4 space-y-1">
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Price: ₹{Number(service.price).toLocaleString()} • Delivery: {service.delivery_time_days} day
                          {service.delivery_time_days === 1 ? "" : "s"}
                        </div>
                        {Array.isArray(service.features) && service.features.length ? (
                          <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
                            {service.features.slice(0, 6).map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )}

                    {blockedReason ? (
                      <div className="text-sm text-destructive">{blockedReason}</div>
                    ) : null}

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button onClick={pay} disabled={paying || !gig || !service || Boolean(blockedReason)}>
                        {paying ? "Processing…" : "Pay now"}
                      </Button>
                      <Button variant="outline" asChild>
                        <Link to={gig ? `/gig/${encodeURIComponent(gig.gig_id)}` : "/gigs"}>Back</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
