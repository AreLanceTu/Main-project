import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import { auth, db } from "@/firebase";
import { uploadOrderFiles, type UploadedFile } from "@/lib/orderUploads";
import { useToast } from "@/hooks/use-toast";

type OrderDoc = {
  orderId: string;
  clientId: string;
  sellerId?: string;
  serviceId: string;
  paymentStatus: string;
  orderStatus: string;
  amountRupees?: number;
  gigId?: string;
  revisionLimit?: number;
  revisionCount?: number;
};

export default function OrderRequirements() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { orderId: orderIdParam } = useParams();
  const orderId = String(orderIdParam || "");

  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [requirements, setRequirements] = useState({
    title: "",
    description: "",
    deliverables: "",
    references: "",
  });
  const [files, setFiles] = useState<File[]>(() => []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "orders", orderId));
        const data = snap.exists() ? (snap.data() as OrderDoc) : null;
        if (!cancelled) setOrder(data);

        const reqSnap = await getDoc(doc(db, "order_requirements", orderId));
        if (reqSnap.exists()) {
          navigate(`/orders/${encodeURIComponent(orderId)}/chat`, { replace: true });
          return;
        }
      } catch (e: any) {
        if (!cancelled) {
          toast({
            title: "Could not load order",
            description: e?.message || "Please try again.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, navigate, toast]);

  const blockedReason = useMemo(() => {
    if (loading) return null;
    if (!user?.uid) return "You must be logged in.";
    if (!order) return "Order not found.";
    if (order.clientId !== user.uid) return "Only the buyer can submit requirements.";
    if (String(order.paymentStatus || "").toLowerCase() !== "paid") return "Payment must be completed first.";
    if (!order.sellerId) return "This order is missing a seller id.";
    return null;
  }, [loading, order, user?.uid]);

  async function submit() {
    if (submitting) return;
    if (blockedReason) {
      toast({ title: "Blocked", description: blockedReason, variant: "destructive" });
      return;
    }
    if (!order || !user?.uid) return;

    const title = String(requirements.title || "").trim();
    const description = String(requirements.description || "").trim();
    if (!title || !description) {
      toast({
        title: "Missing details",
        description: "Please add a title and description.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const uploaded: UploadedFile[] = await uploadOrderFiles({
        orderId,
        userId: user.uid,
        kind: "requirements",
        files,
      });

      const batch = writeBatch(db);

      // Requirements doc.
      batch.set(doc(db, "order_requirements", orderId), {
        orderId,
        buyerId: user.uid,
        sellerId: order.sellerId,
        title,
        description,
        deliverables: String(requirements.deliverables || ""),
        references: String(requirements.references || ""),
        files: uploaded,
        submittedAt: serverTimestamp(),
      });

      // Order status update.
      batch.set(
        doc(db, "orders", orderId),
        {
          orderStatus: "In Progress",
          requirementsSubmitted: true,
          requirementsSubmittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // Create order chat doc (messages live in subcollection).
      batch.set(
        doc(db, "order_chats", orderId),
        {
          orderId,
          buyerId: user.uid,
          sellerId: order.sellerId,
          participants: [user.uid, order.sellerId],
          requirementsSubmitted: true,
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        },
        { merge: true },
      );

      // Notify seller.
      const notifRef = doc(db, "notifications", `${orderId}_requirements`);
      batch.set(
        notifRef,
        {
          id: notifRef.id,
          toUserId: order.sellerId,
          fromUserId: user.uid,
          type: "requirements_submitted",
          orderId,
          title: "Requirements submitted",
          message: `Buyer submitted requirements for order ${orderId}.`,
          createdAt: serverTimestamp(),
          read: false,
        },
        { merge: true },
      );

      await batch.commit();
      navigate(`/orders/${encodeURIComponent(orderId)}/chat`);
    } catch (e: any) {
      toast({
        title: "Could not submit",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Order Requirements - GigFlow</title>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 sm:py-10">
          <div className="max-w-3xl mx-auto space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Project Requirements</CardTitle>
                <CardDescription>Submit details before starting chat and delivery.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {blockedReason ? <div className="text-sm text-destructive">{blockedReason}</div> : null}
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="req-title">Title</Label>
                    <Input
                      id="req-title"
                      value={requirements.title}
                      onChange={(e) => setRequirements((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Redesign landing page sections"
                      disabled={Boolean(blockedReason) || submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="req-desc">Description</Label>
                    <Textarea
                      id="req-desc"
                      value={requirements.description}
                      onChange={(e) => setRequirements((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Share scope, goals, and constraints…"
                      className="min-h-[140px]"
                      disabled={Boolean(blockedReason) || submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="req-deliverables">Deliverables</Label>
                    <Textarea
                      id="req-deliverables"
                      value={requirements.deliverables}
                      onChange={(e) => setRequirements((p) => ({ ...p, deliverables: e.target.value }))}
                      placeholder="What should be delivered?"
                      disabled={Boolean(blockedReason) || submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="req-refs">References / Links</Label>
                    <Textarea
                      id="req-refs"
                      value={requirements.references}
                      onChange={(e) => setRequirements((p) => ({ ...p, references: e.target.value }))}
                      placeholder="Figma links, examples, brand assets…"
                      disabled={Boolean(blockedReason) || submitting}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="req-files">Upload files (optional)</Label>
                    <Input
                      id="req-files"
                      type="file"
                      multiple
                      onChange={(e) => setFiles(Array.from(e.target.files || []))}
                      disabled={Boolean(blockedReason) || submitting}
                    />
                    {!files.length ? (
                      <div className="text-xs text-muted-foreground">
                        Optional — you can submit requirements without any files/images.
                      </div>
                    ) : null}
                    {files.length ? (
                      <div className="text-xs text-muted-foreground">Selected: {files.length} file(s)</div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button onClick={submit} disabled={Boolean(blockedReason) || submitting}>
                      {submitting ? "Submitting…" : "Submit requirements"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/my-orders")}
                      disabled={submitting}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
