import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import { auth, db } from "@/firebase";
import { uploadOrderFiles, type UploadedFile } from "@/lib/orderUploads";
import { supabaseSignedDownloadUrl } from "@/lib/supabaseStorage";
import { useToast } from "@/hooks/use-toast";

type OrderDoc = {
  orderId: string;
  clientId: string;
  sellerId?: string;
  paymentStatus: string;
  orderStatus: string;
  amountRupees?: number;
  razorpayPaymentId?: string;
  revisionLimit?: number;
  revisionCount?: number;
  deliveredAt?: any;
  autoCompleteAt?: any;
};

type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt?: any;
  attachments?: UploadedFile[];
};

type DeliveryDoc = {
  orderId: string;
  sellerId: string;
  buyerId: string;
  message?: string;
  files?: UploadedFile[];
  deliveredAt?: any;
};

function tsToText(ts: any): string {
  try {
    const d = ts?.toDate?.() ?? null;
    if (!d) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

export default function OrderChat() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { orderId: orderIdParam } = useParams();
  const orderId = String(orderIdParam || "");

  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [requirementsExists, setRequirementsExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>(() => []);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachFiles, setAttachFiles] = useState<File[]>(() => []);

  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>(() => []);
  const [delivering, setDelivering] = useState(false);

  const [delivery, setDelivery] = useState<DeliveryDoc | null>(null);

  const [accepting, setAccepting] = useState(false);
  const [requestingRevision, setRequestingRevision] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

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
        const orderSnap = await getDoc(doc(db, "orders", orderId));
        const o = orderSnap.exists() ? (orderSnap.data() as OrderDoc) : null;
        if (!cancelled) setOrder(o);

        const reqSnap = await getDoc(doc(db, "order_requirements", orderId));
        const exists = reqSnap.exists();
        if (!cancelled) setRequirementsExists(exists);

        // Buyer must submit requirements before chat.
        if (o && user?.uid && o.clientId === user.uid && !exists) {
          navigate(`/orders/${encodeURIComponent(orderId)}/requirements`, { replace: true });
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
  }, [orderId, navigate, toast, user?.uid]);

  useEffect(() => {
    if (!orderId) return;
    if (!user?.uid) return;

    const unsubOrder = onSnapshot(
      doc(db, "orders", orderId),
      (snap) => {
        const o = snap.exists() ? (snap.data() as OrderDoc) : null;
        setOrder(o);
      },
      () => {
        setOrder(null);
      },
    );

    const unsubReq = onSnapshot(
      doc(db, "order_requirements", orderId),
      (snap) => setRequirementsExists(snap.exists()),
      () => setRequirementsExists(false),
    );

    const unsubDelivery = onSnapshot(
      doc(db, "order_deliveries", orderId),
      (snap) => {
        const d = snap.exists() ? (snap.data() as DeliveryDoc) : null;
        setDelivery(d);
      },
      () => setDelivery(null),
    );

    return () => {
      unsubOrder();
      unsubReq();
      unsubDelivery();
    };
  }, [orderId, user?.uid]);

  const role = useMemo<"buyer" | "seller" | "none">(() => {
    if (!user?.uid || !order) return "none";
    if (order.clientId === user.uid) return "buyer";
    if (order.sellerId && order.sellerId === user.uid) return "seller";
    return "none";
  }, [order, user?.uid]);

  // Auto-complete after X days if buyer doesn't respond.
  // This only runs when the buyer opens the order.
  const autoCompletedRef = useRef(false);
  useEffect(() => {
    if (autoCompletedRef.current) return;
    if (role !== "buyer") return;
    if (!order) return;
    if (String(order.orderStatus || "") !== "Delivered") return;
    const raw = String(order.autoCompleteAt || "");
    if (!raw) return;

    const t = Date.parse(raw);
    if (!Number.isFinite(t)) return;
    if (Date.now() < t) return;

    autoCompletedRef.current = true;
    void acceptOrder();
    // acceptOrder is stable enough here; the ref prevents loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, role]);

  const canAccess = useMemo(() => {
    if (!user?.uid) return false;
    if (!order) return false;
    return role === "buyer" || role === "seller";
  }, [order, role, user?.uid]);

  useEffect(() => {
    if (!canAccess) return;
    if (!orderId) return;

    const msgsQ = query(
      collection(db, "order_chats", orderId, "messages"),
      orderBy("createdAt", "asc"),
    );

    const unsub = onSnapshot(
      msgsQ,
      (snap) => {
        const items: ChatMessage[] = snap.docs.map((d) => {
          const data: any = d.data() || {};
          return {
            id: d.id,
            senderId: String(data.senderId || ""),
            text: String(data.text || ""),
            createdAt: data.createdAt,
            attachments: Array.isArray(data.attachments) ? data.attachments : [],
          };
        });
        setMessages(items);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      },
      () => {
        setMessages([]);
      },
    );

    return unsub;
  }, [canAccess, orderId]);

  async function send() {
    if (sending) return;
    if (!user?.uid || !order) return;
    if (!canAccess) return;

    if (role === "buyer" && requirementsExists === false) {
      navigate(`/orders/${encodeURIComponent(orderId)}/requirements`);
      return;
    }

    const text = String(draft || "").trim();
    if (!text && !attachFiles.length) return;

    try {
      setSending(true);

      const uploaded = await uploadOrderFiles({
        orderId,
        userId: user.uid,
        kind: "chat",
        files: attachFiles,
      });

      await addDoc(collection(db, "order_chats", orderId, "messages"), {
        senderId: user.uid,
        text,
        attachments: uploaded,
        createdAt: serverTimestamp(),
      });

      await setDoc(
        doc(db, "order_chats", orderId),
        { lastUpdated: serverTimestamp() },
        { merge: true },
      );

      setDraft("");
      setAttachFiles([]);
    } catch (e: any) {
      toast({
        title: "Message not sent",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  async function deliverNow() {
    if (delivering) return;
    if (role !== "seller") return;
    if (!user?.uid || !order) return;

    const status = String(order.orderStatus || "");
    if (!["In Progress", "Revision"].includes(status)) {
      toast({
        title: "Blocked",
        description: "You can deliver only when the order is In Progress or Revision.",
        variant: "destructive",
      });
      return;
    }

    const msg = String(deliveryMessage || "").trim();
    if (!msg && !deliveryFiles.length) {
      toast({
        title: "Missing delivery",
        description: "Add a delivery message or upload files.",
        variant: "destructive",
      });
      return;
    }

    try {
      setDelivering(true);
      const uploaded = await uploadOrderFiles({
        orderId,
        userId: user.uid,
        kind: "delivery",
        files: deliveryFiles,
      });

      const batch = writeBatch(db);
      batch.set(doc(db, "order_deliveries", orderId), {
        orderId,
        sellerId: user.uid,
        buyerId: order.clientId,
        message: msg,
        files: uploaded,
        deliveredAt: serverTimestamp(),
      });

      // Update order status.
      // autoCompleteAt is set client-side for UI prompting; actual automation requires a backend scheduler.
      const autoDays = 3;
      const autoAt = new Date(Date.now() + autoDays * 24 * 60 * 60 * 1000).toISOString();

      batch.set(
        doc(db, "orders", orderId),
        {
          orderStatus: "Delivered",
          deliveredAt: serverTimestamp(),
          autoCompleteAt: autoAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // Notify buyer.
      const notifRef = doc(db, "notifications", `${orderId}_delivered`);
      batch.set(
        notifRef,
        {
          id: notifRef.id,
          toUserId: order.clientId,
          fromUserId: user.uid,
          type: "order_delivered",
          orderId,
          title: "Order delivered",
          message: `Seller delivered files for order ${orderId}.`,
          createdAt: serverTimestamp(),
          read: false,
        },
        { merge: true },
      );

      await batch.commit();
      setDeliveryMessage("");
      setDeliveryFiles([]);
      toast({ title: "Delivered", description: "Delivery submitted." });
    } catch (e: any) {
      toast({
        title: "Delivery failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDelivering(false);
    }
  }

  async function acceptOrder() {
    if (accepting) return;
    if (role !== "buyer") return;
    if (!user?.uid || !order) return;
    const currentStatus = String(order.orderStatus || "");
    if (currentStatus === "Completed") {
      toast({ title: "Already completed", description: "This order is already completed." });
      return;
    }
    if (currentStatus !== "Delivered") {
      toast({
        title: "Blocked",
        description: "You can accept only after delivery.",
        variant: "destructive",
      });
      return;
    }

    try {
      setAccepting(true);

      const amountRupees = Number(order.amountRupees || 0);
      const sellerId = String(order.sellerId || "");
      if (!sellerId) throw new Error("Missing sellerId");
      if (!Number.isFinite(amountRupees) || amountRupees <= 0) throw new Error("Invalid amount");

      // IMPORTANT: Firestore rules for completion records (`transactions`, `wallet_transactions`, `invoices`)
      // require the order to already be `Completed`. `get()` in rules cannot see other pending writes in a batch.
      // So we do two commits: (1) set order status to Completed, then (2) create the completion records.

      const orderRef = doc(db, "orders", orderId);
      await setDoc(
        orderRef,
        { orderStatus: "Completed", completedAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true },
      );

      const freshOrder = await getDoc(orderRef);
      const freshStatus = String((freshOrder.data() as any)?.orderStatus || "");
      if (freshStatus !== "Completed") {
        throw new Error("Order status update did not complete. Please retry.");
      }

      const txRef = doc(db, "transactions", orderId);
      const walletRef = doc(db, "wallet_transactions", `${sellerId}_${orderId}`);
      const invoiceRef = doc(db, "invoices", orderId);
      const notifRef = doc(db, "notifications", `${orderId}_completed`);

      const [txSnap, walletSnap, invoiceSnap, notifSnap] = await Promise.all([
        getDoc(txRef),
        getDoc(walletRef),
        getDoc(invoiceRef),
        getDoc(notifRef),
      ]);

      const batch = writeBatch(db);

      // Transaction record (payment release).
      if (!txSnap.exists()) {
        batch.set(txRef, {
          id: orderId,
          orderId,
          buyerId: user.uid,
          sellerId,
          amountRupees,
          type: "payment_release",
          createdAt: serverTimestamp(),
          razorpayPaymentId: String(order.razorpayPaymentId || ""),
        });
      }

      // Seller wallet transaction entry (balance can be computed from these).
      if (!walletSnap.exists()) {
        batch.set(walletRef, {
          id: `${sellerId}_${orderId}`,
          orderId,
          sellerId,
          amountRupees,
          direction: "credit",
          createdAt: serverTimestamp(),
        });
      }

      // Invoice entry.
      if (!invoiceSnap.exists()) {
        batch.set(invoiceRef, {
          id: orderId,
          orderId,
          buyerId: user.uid,
          sellerId,
          amountRupees,
          createdAt: serverTimestamp(),
          status: "Issued",
        });
      }

      // Notify seller.
      if (!notifSnap.exists()) {
        batch.set(notifRef, {
          id: notifRef.id,
          toUserId: sellerId,
          fromUserId: user.uid,
          type: "order_completed",
          orderId,
          title: "Order completed",
          message: `Buyer accepted order ${orderId}.`,
          createdAt: serverTimestamp(),
          read: false,
        });
      }

      await batch.commit();
      toast({ title: "Completed", description: "Order marked as completed." });
    } catch (e: any) {
      toast({
        title: "Could not complete",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  }

  async function requestRevision() {
    if (requestingRevision) return;
    if (role !== "buyer") return;
    if (!user?.uid || !order) return;
    if (String(order.orderStatus || "") !== "Delivered") {
      toast({
        title: "Blocked",
        description: "You can request revision only after delivery.",
        variant: "destructive",
      });
      return;
    }

    const used = Number(order.revisionCount || 0);
    const limit = Number(order.revisionLimit || 2);
    if (used >= limit) {
      toast({
        title: "Revision limit reached",
        description: `This order includes ${limit} revision(s).`,
        variant: "destructive",
      });
      return;
    }

    try {
      setRequestingRevision(true);
      const batch = writeBatch(db);
      batch.set(
        doc(db, "orders", orderId),
        {
          orderStatus: "Revision",
          revisionCount: used + 1,
          revisionRequestedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      // Notify seller.
      const notifRef = doc(db, "notifications", `${orderId}_revision_${used + 1}`);
      batch.set(
        notifRef,
        {
          id: notifRef.id,
          toUserId: order.sellerId,
          fromUserId: user.uid,
          type: "revision_requested",
          orderId,
          title: "Revision requested",
          message: `Buyer requested a revision for order ${orderId}.`,
          createdAt: serverTimestamp(),
          read: false,
        },
        { merge: true },
      );

      await batch.commit();
      toast({ title: "Revision requested", description: "Seller has been notified." });
    } catch (e: any) {
      toast({
        title: "Could not request revision",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRequestingRevision(false);
    }
  }

  const headerStatus = useMemo(() => {
    const s = String(order?.orderStatus || "");
    return s ? s : "—";
  }, [order?.orderStatus]);

  const revisionInfo = useMemo(() => {
    const used = Number(order?.revisionCount || 0);
    const limit = Number(order?.revisionLimit || 2);
    return { used, limit, remaining: Math.max(0, limit - used) };
  }, [order?.revisionCount, order?.revisionLimit]);

  const waitingForRequirements = role === "seller" && requirementsExists === false;

  async function openUploadedFile(file: UploadedFile) {
    const path = String(file?.path || "").trim();
    if (path) {
      try {
        const { signedUrl } = await supabaseSignedDownloadUrl({
          bucket: "orders",
          path,
          expiresInSeconds: 60 * 30,
        });
        if (!signedUrl) throw new Error("No signed URL returned");
        window.open(signedUrl, "_blank", "noopener,noreferrer");
        return;
      } catch (e: any) {
        toast({
          title: "Could not open file",
          description: e?.message || "Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    const direct = String(file?.url || "").trim();
    if (direct) {
      window.open(direct, "_blank", "noopener,noreferrer");
      return;
    }

    {
      toast({
        title: "Could not open file",
        description: "Missing file path.",
        variant: "destructive",
      });
      return;
    }
  }

  return (
    <>
      <Helmet>
        <title>Order Chat - GigFlow</title>
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-6 sm:py-10">
          <div className="max-w-5xl mx-auto space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Order Chat</CardTitle>
                <CardDescription>
                  Order: <span className="font-mono text-xs">{orderId}</span> · Status: <Badge variant="outline">{headerStatus}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!loading && !canAccess ? (
                  <div className="text-sm text-destructive">You don’t have access to this order.</div>
                ) : null}

                {waitingForRequirements ? (
                  <div className="text-sm text-muted-foreground">Waiting for buyer to submit requirements.</div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">Messages</CardTitle>
                      <CardDescription>Only buyer and seller can access this chat.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ScrollArea className="h-[420px] rounded-md border">
                        <div className="p-3 space-y-3">
                          {messages.length ? (
                            messages.map((m) => (
                              <div key={m.id} className="space-y-1">
                                <div className="text-xs text-muted-foreground">
                                  {m.senderId === user?.uid ? "You" : "Them"}
                                  {m.createdAt ? <span className="ml-2">{tsToText(m.createdAt)}</span> : null}
                                </div>
                                {m.text ? <div className="text-sm whitespace-pre-wrap">{m.text}</div> : null}
                                {Array.isArray(m.attachments) && m.attachments.length ? (
                                  <div className="text-xs">
                                    {m.attachments.map((a) => (
                                      <div key={a.path}>
                                        <button type="button" className="underline" onClick={() => void openUploadedFile(a)}>
                                          {a.name}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                <Separator />
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground">No messages yet.</div>
                          )}
                          <div ref={bottomRef} />
                        </div>
                      </ScrollArea>

                      <div className="space-y-2">
                        <Textarea
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder={role === "buyer" && requirementsExists === false ? "Submit requirements to start chat." : "Type a message…"}
                          disabled={!canAccess || sending || (role === "buyer" && requirementsExists === false)}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              multiple
                              onChange={(e) => setAttachFiles(Array.from(e.target.files || []))}
                              disabled={!canAccess || sending || (role === "buyer" && requirementsExists === false)}
                            />
                          </div>
                          <Button onClick={send} disabled={!canAccess || sending || (!draft.trim() && !attachFiles.length) || (role === "buyer" && requirementsExists === false)}>
                            {sending ? "Sending…" : "Send"}
                          </Button>
                        </div>
                        {attachFiles.length ? (
                          <div className="text-xs text-muted-foreground">Selected: {attachFiles.length} file(s)</div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    {delivery ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Latest Delivery</CardTitle>
                          <CardDescription>
                            {delivery.deliveredAt ? `Delivered at: ${tsToText(delivery.deliveredAt)}` : "Delivery details"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {delivery.message ? <div className="text-sm whitespace-pre-wrap">{delivery.message}</div> : null}
                          {Array.isArray(delivery.files) && delivery.files.length ? (
                            <div className="text-sm">
                              <div className="text-xs text-muted-foreground mb-1">Files</div>
                              <div className="space-y-1">
                                {delivery.files.map((f) => (
                                  <div key={f.path}>
                                    <button type="button" className="underline" onClick={() => void openUploadedFile(f)}>
                                      {f.name}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">No files attached.</div>
                          )}
                        </CardContent>
                      </Card>
                    ) : null}

                    {role === "seller" ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Delivery</CardTitle>
                          <CardDescription>Upload final files and deliver.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="delivery-message">Delivery message</Label>
                            <Textarea
                              id="delivery-message"
                              value={deliveryMessage}
                              onChange={(e) => setDeliveryMessage(e.target.value)}
                              placeholder="Explain what you delivered…"
                              disabled={delivering || !canAccess}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="delivery-files">Upload files</Label>
                            <Input
                              id="delivery-files"
                              type="file"
                              multiple
                              onChange={(e) => setDeliveryFiles(Array.from(e.target.files || []))}
                              disabled={delivering || !canAccess}
                            />
                            {deliveryFiles.length ? (
                              <div className="text-xs text-muted-foreground">Selected: {deliveryFiles.length} file(s)</div>
                            ) : null}
                          </div>
                          <Button onClick={deliverNow} disabled={delivering || !canAccess}>
                            {delivering ? "Delivering…" : "Deliver Now"}
                          </Button>
                        </CardContent>
                      </Card>
                    ) : null}

                    {role === "buyer" ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Review</CardTitle>
                          <CardDescription>Accept or request revision after delivery.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-sm text-muted-foreground">
                            Revisions remaining: <span className="font-medium text-foreground">{revisionInfo.remaining}</span>
                          </div>

                          <Button onClick={acceptOrder} disabled={accepting || !canAccess}>
                            {accepting ? "Completing…" : "Accept Order"}
                          </Button>
                          <Button onClick={requestRevision} variant="outline" disabled={requestingRevision || !canAccess}>
                            {requestingRevision ? "Requesting…" : "Request Revision"}
                          </Button>

                          {order?.autoCompleteAt ? (
                            <div className="text-xs text-muted-foreground">
                              Auto-complete prompt: {String(order.autoCompleteAt)}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Order</CardTitle>
                        <CardDescription>Quick links</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button variant="outline" onClick={() => navigate("/my-orders")}>
                          Back to orders
                        </Button>
                        {role === "buyer" && requirementsExists === false ? (
                          <Button onClick={() => navigate(`/orders/${encodeURIComponent(orderId)}/requirements`)}>
                            Submit requirements
                          </Button>
                        ) : null}
                      </CardContent>
                    </Card>
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
