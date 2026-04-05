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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

import { auth, db } from "@/firebase";
import { uploadOrderFiles, type UploadedFile } from "@/lib/orderUploads";
import { supabaseSignedDownloadUrl } from "@/lib/supabaseStorage";
import { useToast } from "@/hooks/use-toast";
import { getStoredGig } from "@/lib/gigStore";

type OrderDoc = {
  orderId: string;
  clientId: string;
  sellerId?: string;
  gigId?: string;
  serviceId?: string;
  paymentStatus: string;
  orderStatus: string;
  amountRupees?: number;
  razorpayPaymentId?: string;
  revisionLimit?: number;
  revisionCount?: number;
  deliveryTimeDays?: number;
  dueAt?: any;
  createdAt?: any;
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

type UserProfileDoc = {
  username?: string;
  usernameLower?: string;
  name?: string;
  displayName?: string;
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

function tsToMillis(ts: any): number | null {
  try {
    if (!ts) return null;
    if (typeof ts?.toMillis === "function") {
      const n = ts.toMillis();
      return Number.isFinite(n) ? n : null;
    }
    const d = ts?.toDate?.() ?? null;
    if (d instanceof Date) {
      const n = d.getTime();
      return Number.isFinite(n) ? n : null;
    }
    return null;
  } catch {
    return null;
  }
}

function formatCountdownParts(ms: number) {
  const abs = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(abs / (24 * 3600));
  const hours = Math.floor((abs % (24 * 3600)) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;
  return { days, hours, minutes, seconds };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hash32FNV1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function orderNumberDigits(orderId: string): string {
  const id = String(orderId || "").trim();
  if (!id) return "";
  const n = hash32FNV1a(id) % 1_000_000_000; // 9 digits
  return String(n).padStart(9, "0");
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

  const [nowMs, setNowMs] = useState(() => Date.now());

  const [buyerUsername, setBuyerUsername] = useState<string | null>(null);
  const [sellerUsername, setSellerUsername] = useState<string | null>(null);

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

  useEffect(() => {
    if (!order?.clientId) {
      setBuyerUsername(null);
      return undefined;
    }

    const unsub = onSnapshot(
      doc(db, "users", String(order.clientId)),
      (snap) => {
        const data = (snap.data() || {}) as UserProfileDoc;
        const u = data.username || data.usernameLower || null;
        setBuyerUsername(u ? String(u) : null);
      },
      () => setBuyerUsername(null),
    );

    return unsub;
  }, [order?.clientId]);

  useEffect(() => {
    if (!order?.sellerId) {
      setSellerUsername(null);
      return undefined;
    }

    const unsub = onSnapshot(
      doc(db, "users", String(order.sellerId)),
      (snap) => {
        const data = (snap.data() || {}) as UserProfileDoc;
        const u = data.username || data.usernameLower || null;
        setSellerUsername(u ? String(u) : null);
      },
      () => setSellerUsername(null),
    );

    return unsub;
  }, [order?.sellerId]);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

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

  const orderGig = useMemo(() => {
    const gigId = String(order?.gigId || "");
    if (!gigId) return null;
    return getStoredGig(gigId);
  }, [order?.gigId]);

  const orderService = useMemo(() => {
    const serviceId = String(order?.serviceId || "");
    const services = Array.isArray((orderGig as any)?.services) ? (orderGig as any).services : [];
    if (!serviceId) return null;
    return services.find((s: any) => String(s?.service_id) === serviceId) || null;
  }, [order?.serviceId, orderGig]);

  const dueMs = useMemo(() => tsToMillis(order?.dueAt), [order?.dueAt]);
  const dueText = useMemo(() => tsToText(order?.dueAt) || "—", [order?.dueAt]);
  const remainingMs = useMemo(() => {
    if (!dueMs) return null;
    return dueMs - nowMs;
  }, [dueMs, nowMs]);

  const countdown = useMemo(() => {
    if (remainingMs === null) return null;
    const overdue = remainingMs < 0;
    const parts = formatCountdownParts(Math.abs(remainingMs));
    return { overdue, ...parts };
  }, [remainingMs]);

  const orderProgress = useMemo(() => {
    const status = String(order?.orderStatus || "");
    if (!status) return 0;
    if (status === "Pending") return 25;
    if (status === "In Progress" || status === "Revision") return 55;
    if (status === "Delivered") return 80;
    if (status === "Completed") return 100;
    return 40;
  }, [order?.orderStatus]);

  const numericOrderNo = useMemo(() => orderNumberDigits(order?.orderId || orderId), [order?.orderId, orderId]);
  const orderedByLabel = useMemo(() => {
    const buyerId = String(order?.clientId || "");
    if (user?.uid && buyerId && user.uid === buyerId) return "You";
    if (buyerUsername) return `@${buyerUsername}`;
    return buyerId || "—";
  }, [buyerUsername, order?.clientId, user?.uid]);

  const sellerLabel = useMemo(() => {
    const sellerId = String(order?.sellerId || "");
    if (user?.uid && sellerId && user.uid === sellerId) return "You";
    if (sellerUsername) return `@${sellerUsername}`;
    return sellerId || "—";
  }, [order?.sellerId, sellerUsername, user?.uid]);

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

                <Tabs defaultValue="activity" className="w-full">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="requirements">Requirements</TabsTrigger>
                    <TabsTrigger value="stock">Stock Media</TabsTrigger>
                  </TabsList>

                  <TabsContent value="activity" className="mt-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Card className="lg:col-span-2">
                        <CardHeader>
                          <CardTitle className="text-base">Messages</CardTitle>
                          <CardDescription>Only buyer and seller can access this order.</CardDescription>
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
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Time left to deliver</CardTitle>
                            <CardDescription>{dueMs ? (countdown?.overdue ? "Past due" : "On track") : "Delivery time"}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {countdown ? (
                              <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="rounded-md border p-2">
                                  <div className="text-lg font-semibold">{String(countdown.days).padStart(2, "0")}</div>
                                  <div className="text-xs text-muted-foreground">Days</div>
                                </div>
                                <div className="rounded-md border p-2">
                                  <div className="text-lg font-semibold">{String(countdown.hours).padStart(2, "0")}</div>
                                  <div className="text-xs text-muted-foreground">Hours</div>
                                </div>
                                <div className="rounded-md border p-2">
                                  <div className="text-lg font-semibold">{String(countdown.minutes).padStart(2, "0")}</div>
                                  <div className="text-xs text-muted-foreground">Minutes</div>
                                </div>
                                <div className="rounded-md border p-2">
                                  <div className="text-lg font-semibold">{String(countdown.seconds).padStart(2, "0")}</div>
                                  <div className="text-xs text-muted-foreground">Seconds</div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">No delivery due date set for this order.</div>
                            )}

                            <div className="text-xs text-muted-foreground">Delivery date: {dueText}</div>

                            {role === "seller" ? (
                              <Button
                                onClick={() => {
                                  const el = document.getElementById("delivery-panel");
                                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                                className="w-full"
                              >
                                Deliver Now
                              </Button>
                            ) : null}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Order Details</CardTitle>
                            <CardDescription>Summary</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-muted-foreground">Service</div>
                              <div className="text-right font-medium">{String((orderService as any)?.name || order?.serviceId || "—")}</div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-muted-foreground">Gig</div>
                              <div className="text-right font-medium">{String((orderGig as any)?.title || order?.gigId || "—")}</div>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-muted-foreground">Ordered by</div>
                              <div className="text-right font-medium">{orderedByLabel}</div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-muted-foreground">Seller</div>
                              <div className="text-right font-medium">{sellerLabel}</div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-muted-foreground">Delivery date</div>
                              <div className="text-right">{dueText}</div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-muted-foreground">Total price</div>
                              <div className="text-right font-medium">₹{Number(order?.amountRupees || 0).toLocaleString()}</div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-muted-foreground">Order number</div>
                              <div className="text-right font-mono text-xs">{numericOrderNo ? `#${numericOrderNo}` : "—"}</div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Track Order</CardTitle>
                            <CardDescription>Status & progress</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Progress value={clamp(orderProgress, 0, 100)} />
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Requirements submitted</span>
                                <Badge variant={requirementsExists ? "default" : "outline"}>{requirementsExists ? "Yes" : "No"}</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Order status</span>
                                <Badge variant="outline">{headerStatus}</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

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
                        <div id="delivery-panel" />
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
                  </TabsContent>

                  <TabsContent value="details" className="mt-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <Card className="lg:col-span-2">
                        <CardHeader>
                          <CardTitle className="text-base">Order Details</CardTitle>
                          <CardDescription>Metadata and timeline</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-muted-foreground">Order number</div>
                            <div className="font-mono text-xs">{numericOrderNo ? `#${numericOrderNo}` : "—"}</div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-muted-foreground">Order ID</div>
                            <div className="font-mono text-xs">{String(order?.orderId || orderId)}</div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-muted-foreground">Payment status</div>
                            <Badge variant="outline">{String(order?.paymentStatus || "—")}</Badge>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-muted-foreground">Order status</div>
                            <Badge variant="outline">{headerStatus}</Badge>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-muted-foreground">Created</div>
                            <div>{tsToText(order?.createdAt) || "—"}</div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-muted-foreground">Due</div>
                            <div>{dueText}</div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-muted-foreground">Delivery time</div>
                            <div>{Number(order?.deliveryTimeDays || 0) ? `${Number(order?.deliveryTimeDays)} day(s)` : "—"}</div>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-muted-foreground">Buyer</div>
                            <div className="font-medium">{orderedByLabel}</div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-muted-foreground">Seller</div>
                            <div className="font-medium">{sellerLabel}</div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Track Order</CardTitle>
                            <CardDescription>Status & progress</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Progress value={clamp(orderProgress, 0, 100)} />
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Requirements submitted</span>
                                <Badge variant={requirementsExists ? "default" : "outline"}>{requirementsExists ? "Yes" : "No"}</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Order status</span>
                                <Badge variant="outline">{headerStatus}</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Order</CardTitle>
                            <CardDescription>Quick links</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <Button variant="outline" onClick={() => navigate("/my-orders")}>Back to orders</Button>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="requirements" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Requirements</CardTitle>
                        <CardDescription>Buyer requirements for this order.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm">
                          Status: <Badge variant={requirementsExists ? "default" : "outline"}>{requirementsExists ? "Submitted" : "Not submitted"}</Badge>
                        </div>
                        <Button onClick={() => navigate(`/orders/${encodeURIComponent(orderId)}/requirements`)}>
                          {requirementsExists ? "View requirements" : "Submit requirements"}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="stock" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Stock Media</CardTitle>
                        <CardDescription>Files linked to this order.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">No stock media has been added for this order.</div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}
