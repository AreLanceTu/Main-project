import { Helmet } from "react-helmet-async";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { createBlendy, type Blendy } from "blendy";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStoredGig } from "@/lib/gigStore";
import { BadgeCheck, Clock, ShieldCheck, Star } from "lucide-react";

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
  seller_id: string;
  description_html?: string;
  services?: StoredService[];
};

const Gig = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const blendyRef = useRef<Blendy | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<StoredService | null>(null);
  const [activeBlendyId, setActiveBlendyId] = useState<string | null>(null);

  const gig = (getStoredGig(id || "") as StoredGig | null) || null;
  const services = gig?.services || [];
  const startingPrice = services.length
    ? Math.min(...services.map((s) => Number(s.price) || Number.POSITIVE_INFINITY))
    : null;
  const defaultService = services.length
    ? services.reduce((best, current) => {
        const bestPrice = Number(best?.price);
        const currentPrice = Number(current?.price);
        if (!Number.isFinite(bestPrice)) return current;
        if (!Number.isFinite(currentPrice)) return best;
        return currentPrice < bestPrice ? current : best;
      }, services[0])
    : null;
  const minDeliveryDays = services.length
    ? Math.min(...services.map((s) => Number(s.delivery_time_days) || Number.POSITIVE_INFINITY))
    : null;
  const heroImageSrc = gig?.cover_image_url || "/mock-service-banner.svg";
  const sellerName = gig?.seller_id
    ? `Seller ${String(gig.seller_id).slice(0, 8)}`
    : "Verified seller";

  const defaultServiceId = defaultService?.service_id || services?.[0]?.service_id || "";
  const [mobilePackageId, setMobilePackageId] = useState<string>(defaultServiceId);

  useEffect(() => {
    setMobilePackageId(defaultServiceId);
  }, [defaultServiceId]);

  const packagesPanel = (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold">Choose your package</h2>
        <p className="text-sm text-muted-foreground">Clear deliverables, transparent pricing.</p>
      </div>

      {services.length > 1 ? (
        <div className="sm:hidden">
          <Tabs value={mobilePackageId} onValueChange={setMobilePackageId}>
            <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${Math.min(services.length, 3)}, minmax(0, 1fr))` }}>
              {services.slice(0, 3).map((s) => (
                <TabsTrigger key={s.service_id} value={s.service_id} className="truncate">
                  {s.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {services.slice(0, 3).map((s) => (
              <TabsContent key={s.service_id} value={s.service_id} className="mt-4">
                <Card className="w-full rounded-2xl bg-surface hover:bg-surface border-border/60 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{s.name}</CardTitle>
                        <CardDescription>
                          Delivery: {s.delivery_time_days} day{s.delivery_time_days === 1 ? "" : "s"}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold">₹{Number(s.price).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">one-time</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.isArray(s.features) && s.features.length ? (
                      <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                        {s.features.slice(0, 6).map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground">Includes standard deliverables.</div>
                    )}
                    <Button
                      className="w-full"
                      onClick={() => openPurchase(s)}
                      data-blendy-from={id ? `purchase:${id}:${s.service_id}` : undefined}
                    >
                      <span>Continue</span>
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
          {services.length > 3 ? (
            <div className="mt-3 text-xs text-muted-foreground text-center">
              More packages available on desktop.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="hidden sm:flex flex-col gap-4">
        {services.map((s) => (
          <Card
            key={s.service_id}
            className="w-full rounded-2xl bg-surface hover:bg-surface border-border/60 transition-colors"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <CardDescription>
                    Delivery: {s.delivery_time_days} day{s.delivery_time_days === 1 ? "" : "s"}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold">₹{Number(s.price).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">one-time</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.isArray(s.features) && s.features.length ? (
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  {s.features.slice(0, 6).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">Includes standard deliverables.</div>
              )}
              <Button
                className="w-full"
                onClick={() => openPurchase(s)}
                data-blendy-from={id ? `purchase:${id}:${s.service_id}` : undefined}
              >
                <span>Continue</span>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  useEffect(() => {
    // Instantiate after the initial DOM has loaded.
    blendyRef.current = createBlendy({ animation: "spring" });
    blendyRef.current.update();
    return () => {
      blendyRef.current = null;
    };
  }, []);

  useEffect(() => {
    // New services / dynamic DOM updates.
    blendyRef.current?.update();
  }, [services.length]);

  function buy(serviceId: string) {
    if (!id || !serviceId) return;
    navigate(
      `/checkout?gigId=${encodeURIComponent(id)}&serviceId=${encodeURIComponent(serviceId)}`,
    );
  }

  function openPurchase(service: StoredService) {
    if (!id) return;
    const blendyId = `purchase:${id}:${service.service_id}`;
    setSelectedService(service);
    setActiveBlendyId(blendyId);
    setPurchaseOpen(true);

    // Wait for the Dialog to render its target element.
    requestAnimationFrame(() => {
      blendyRef.current?.update();
      blendyRef.current?.toggle(blendyId);
    });
  }

  function closePurchase() {
    const cleanup = () => {
      setPurchaseOpen(false);
      setSelectedService(null);
      setActiveBlendyId(null);
    };

    // If we don't have a valid blendy id, just close immediately.
    if (!activeBlendyId) {
      cleanup();
      return;
    }

    // Blendy's onDone callback can be missed in some DOM timing cases.
    // Use a short fallback timer so the UI never gets stuck open.
    let didFinish = false;
    const fallback = window.setTimeout(() => {
      if (didFinish) return;
      cleanup();
    }, 450);

    try {
      blendyRef.current?.untoggle(activeBlendyId, () => {
        didFinish = true;
        window.clearTimeout(fallback);
        cleanup();
      });
    } catch {
      window.clearTimeout(fallback);
      cleanup();
    }
  }

  return (
    <>
      <Helmet>
        <title>{gig?.title ? `${gig.title} - GigFlow` : "Gig Details - GigFlow"}</title>
        <meta name="description" content="View gig details." />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />

        <main className="flex-1 container mx-auto px-3 sm:px-4 pt-6 pb-24 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mx-auto w-full max-w-6xl"
          >
            {!gig ? (
              <>
                <h1 className="text-3xl font-bold text-foreground mb-4">Gig not found</h1>
                <p className="text-muted-foreground mb-8">
                  This gig isn’t available yet. If you just created it, try going back to the dashboard
                  and opening it again.
                </p>
                <Button asChild>
                  <Link to="/gigs">Browse gigs</Link>
                </Button>
              </>
            ) : (
              <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
                <section className="space-y-6 lg:col-span-2">
                  <header className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="text-sm text-muted-foreground">
                        <Link to="/" className="hover:underline">
                          Home
                        </Link>
                        <span className="mx-2">/</span>
                        <Link to="/gigs" className="hover:underline">
                          Gigs
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                          <BadgeCheck className="h-4 w-4" />
                          Verified
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheck className="h-4 w-4" />
                          Secure checkout
                        </Badge>
                      </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                      {gig.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        4.9 (200+)
                      </span>
                      {minDeliveryDays && Number.isFinite(minDeliveryDays) ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          From {minDeliveryDays} day{minDeliveryDays === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {startingPrice && Number.isFinite(startingPrice) ? (
                        <span className="font-medium text-foreground">
                          Starting at ₹{Number(startingPrice).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </header>

                  <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <div className="aspect-[16/9]">
                      <img
                        src={heroImageSrc}
                        alt={gig.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </div>

                  <div id="packages" className="lg:hidden">
                    {packagesPanel}
                  </div>

                  <Card className="rounded-2xl bg-surface hover:bg-surface border-border/60 transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Description</CardTitle>
                      <CardDescription>What you’ll get and how it works</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {gig.description_html ? (
                        <div
                          className="prose prose-sm md:prose-base max-w-none prose-headings:tracking-tight prose-p:leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: gig.description_html }}
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground">No description provided.</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl bg-surface hover:bg-surface border-border/60 transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">About the seller</CardTitle>
                      <CardDescription>Trusted, responsive, and delivery-focused</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{sellerName}</div>
                          <div className="text-sm text-muted-foreground">
                            Top Rated • Fast replies • Professional communication
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          Available
                        </Badge>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-muted-foreground">Avg. response</div>
                          <div className="font-medium">1 hour</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Last delivery</div>
                          <div className="font-medium">Today</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Languages</div>
                          <div className="font-medium">English, Hindi</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">On-time</div>
                          <div className="font-medium">98%</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl bg-surface hover:bg-surface border-border/60 transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Reviews</CardTitle>
                      <CardDescription>Recent feedback from buyers</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium text-foreground">4.9</span>
                          </span>
                          <span className="text-sm text-muted-foreground">Based on 200+ orders</span>
                        </div>
                        <Button variant="outline" size="sm">See all</Button>
                      </div>

                      <div className="space-y-3">
                        {[
                          {
                            name: "Ananya",
                            text: "Clean delivery and great communication. Exactly what I needed.",
                          },
                          {
                            name: "Rohit",
                            text: "Fast turnaround and high-quality output. Would order again.",
                          },
                          {
                            name: "Meera",
                            text: "Professional work, followed the brief closely, and shared updates.",
                          },
                        ].map((r) => (
                          <div key={r.name} className="rounded-xl border bg-background/40 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium">{r.name}</div>
                              <div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                                <Star className="h-4 w-4 text-yellow-500" /> 5.0
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
                              {r.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl bg-surface hover:bg-surface border-border/60 transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">FAQ</CardTitle>
                      <CardDescription>Quick answers before you order</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="scope">
                          <AccordionTrigger>What do you need from me to start?</AccordionTrigger>
                          <AccordionContent>
                            A short brief, references (if any), and your target audience. You can share links,
                            brand assets, and examples you like.
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="revisions">
                          <AccordionTrigger>Do you offer revisions?</AccordionTrigger>
                          <AccordionContent>
                            Yes—each package includes standard revisions. If you need major changes or extra
                            rounds, you can upgrade or add-ons can be discussed.
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="timeline">
                          <AccordionTrigger>Can you deliver faster?</AccordionTrigger>
                          <AccordionContent>
                            If my schedule allows, I can prioritize your order for faster delivery. Choose a
                            higher package or message before ordering.
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="files">
                          <AccordionTrigger>What files will I receive?</AccordionTrigger>
                          <AccordionContent>
                            You’ll receive production-ready deliverables (and source files when included in the
                            package). Details vary by package.
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl bg-surface hover:bg-surface border-border/60 transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Portfolio</CardTitle>
                      <CardDescription>Sample work and outcomes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {[
                          {
                            title: "Brand identity refresh",
                            img: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=600&fit=crop",
                          },
                          {
                            title: "Landing page UI",
                            img: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=800&h=600&fit=crop",
                          },
                          {
                            title: "Social media creatives",
                            img: "https://images.unsplash.com/photo-1611162617213-7d7a39e9ed75?w=800&h=600&fit=crop",
                          },
                          {
                            title: "Product visuals",
                            img: "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=800&h=600&fit=crop",
                          },
                        ].map((p) => (
                          <div key={p.title} className="overflow-hidden rounded-xl border bg-card">
                            <div className="aspect-[16/10]">
                              <img
                                src={p.img}
                                alt={p.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div className="p-3">
                              <div className="text-sm font-medium">{p.title}</div>
                              <div className="text-xs text-muted-foreground">Preview</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl bg-surface hover:bg-surface border-border/60 transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Terms</CardTitle>
                      <CardDescription>Delivery, usage, and expectations</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                        <li>Delivery time starts after requirements are received.</li>
                        <li>Minor revisions are included; major scope changes may need an upgrade.</li>
                        <li>Final files are delivered via the platform chat/attachments.</li>
                        <li>Commercial use is included unless stated otherwise in the package.</li>
                      </ul>
                    </CardContent>
                  </Card>
                </section>

                <aside className="hidden lg:block lg:col-span-1">
                  <div className="lg:sticky lg:top-24 space-y-4">
                    {packagesPanel}
                  </div>
                </aside>
              </div>
            )}

            <Dialog
              open={purchaseOpen}
              onOpenChange={(next) => {
                if (next) {
                  setPurchaseOpen(true);
                  return;
                }
                closePurchase();
              }}
            >
              <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl">
                {activeBlendyId ? (
                  <div data-blendy-to={activeBlendyId}>
                    <div className="p-6">
                      <DialogHeader>
                        <DialogTitle>Confirm package</DialogTitle>
                        <DialogDescription>
                          Review the package details before continuing to checkout.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="mt-4 rounded-xl border bg-surface/50 p-4 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {selectedService?.name || "Package"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Delivery: {selectedService?.delivery_time_days ?? 0} day
                              {selectedService?.delivery_time_days === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-semibold">
                              ₹{Number(selectedService?.price || 0).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">one-time</div>
                          </div>
                        </div>

                        {Array.isArray(selectedService?.features) && selectedService?.features?.length ? (
                          <ul className="pt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
                            {selectedService.features.slice(0, 6).map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <DialogFooter className="mt-6 gap-2">
                        <Button type="button" variant="outline" onClick={closePurchase}>
                          Back
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            if (!selectedService) return;
                            buy(selectedService.service_id);
                          }}
                        >
                          Continue to checkout
                        </Button>
                      </DialogFooter>
                    </div>
                  </div>
                ) : null}
              </DialogContent>
            </Dialog>

            <div className="mt-8">
              <Button variant="outline" asChild>
                <Link to="/gigs">← Back to gigs</Link>
              </Button>
            </div>
          </motion.div>
        </main>

        {gig && services.length && defaultService ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
            <div className="container mx-auto flex items-center justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Starting at</div>
                <div className="font-semibold truncate">
                  ₹{Number(startingPrice ?? defaultService.price).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="#packages">Packages</a>
                </Button>
                <Button size="sm" onClick={() => openPurchase(defaultService)}>
                  Continue
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <Footer />
      </div>
    </>
  );
};

export default Gig;
