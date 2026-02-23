import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, limit, query, where, type Timestamp } from "firebase/firestore";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { auth, db } from "@/firebase";

type OrderDoc = {
  orderId: string;
  clientId: string;
  serviceId: string;
  paymentStatus: "Paid" | "Failed" | string;
  orderStatus: "Pending" | "Completed" | string;
  createdAt?: Timestamp | null;
};

function formatCreatedAt(ts?: Timestamp | null): string {
  try {
    if (!ts) return "—";
    const d = ts.toDate();
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

export default function MyOrders() {
  const [uid, setUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderDoc[]>(() => []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, "orders"),
          where("clientId", "==", uid),
          limit(25),
        );

        const snap = await getDocs(q);
        const items = snap.docs.map((d) => d.data() as OrderDoc);

        // Sort newest first (avoid requiring Firestore composite indexes).
        items.sort((a, b) => {
          const aa = a.createdAt?.toMillis?.() ?? 0;
          const bb = b.createdAt?.toMillis?.() ?? 0;
          return bb - aa;
        });

        if (!cancelled) setOrders(items);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load orders");
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const emptyState = useMemo(() => {
    if (loading) return "Loading your orders…";
    if (error) return error;
    return "No orders found yet.";
  }, [error, loading]);

  return (
    <>
      <Helmet>
        <title>My Orders - GigFlow</title>
        <meta name="description" content="My Orders" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />

        <main className="flex-1 container mx-auto px-4 py-10">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>My Orders</CardTitle>
                <CardDescription>Recent purchases linked to your account.</CardDescription>
              </CardHeader>
              <CardContent>
                {!orders.length ? (
                  <div className="text-sm text-muted-foreground">{emptyState}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Service ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((o) => (
                          <TableRow key={o.orderId}>
                            <TableCell className="font-mono text-xs">{o.orderId}</TableCell>
                            <TableCell className="font-mono text-xs">{o.serviceId}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{o.orderStatus}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={o.paymentStatus === "Paid" ? "default" : "destructive"}>
                                {o.paymentStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatCreatedAt(o.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
