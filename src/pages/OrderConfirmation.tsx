import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo } from "react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { getStoredGig } from "@/lib/gigStore";

export default function OrderConfirmation() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const gigId = params.get("gigId") || "";
  const serviceId = params.get("serviceId") || "";
  const paymentId = params.get("paymentId") || "";
  const sellerIdFromParams = params.get("sellerId") || "";

  const gig = useMemo(() => getStoredGig(gigId), [gigId]);
  const sellerId = useMemo(() => {
    if (sellerIdFromParams) return sellerIdFromParams;
    return String((gig as any)?.seller_id || "");
  }, [gig, sellerIdFromParams]);

  const chatHref = useMemo(() => {
    if (!sellerId) return "/messages";
    return `/messages?with=${encodeURIComponent(sellerId)}`;
  }, [sellerId]);

  const service = useMemo(() => {
    const list = (gig as any)?.services || [];
    return list.find((s: any) => String(s?.service_id) === String(serviceId)) || null;
  }, [gig, serviceId]);

  useEffect(() => {
    // Only auto-redirect when this page is reached from a fresh payment.
    if (!paymentId) return;
    if (!sellerId) return;

    navigate(chatHref, { replace: true });
  }, [chatHref, navigate, paymentId, sellerId]);

  return (
    <>
      <Helmet>
        <title>Order Confirmation - GigFlow</title>
        <meta name="description" content="Order confirmation" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />

        <main className="flex-1 container mx-auto px-4 py-10">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Order confirmed</CardTitle>
                <CardDescription>Your payment was successful.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">Gig: {gig?.title || gigId}</div>
                <div className="text-sm text-muted-foreground">Package: {service?.name || serviceId}</div>
                {paymentId ? (
                  <div className="text-sm text-muted-foreground">Payment ID: {paymentId}</div>
                ) : null}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button asChild>
                    <Link to={chatHref}>Chat with freelancer</Link>
                  </Button>
                  <Button asChild>
                    <Link to={gigId ? `/gig/${encodeURIComponent(gigId)}` : "/gigs"}>View gig</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/gigs">Browse more</Link>
                  </Button>
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
