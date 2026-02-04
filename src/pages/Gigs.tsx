import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Search, Filter, SlidersHorizontal, Star, Heart, Clock, ChevronDown, Grid, List } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "react-router-dom";
import { getStoredGig, listStoredGigs, upsertStoredGig } from "@/lib/gigStore";

interface Gig {
  id: string;
  title: string;
  image: string;
  seller: {
    name: string;
    avatar: string;
    level: string;
  };
  rating: number;
  price: number;
  deliveryTime: string;
  category: string;
}

type GigItem = Gig & {
  source: "stored" | "base";
};

type StoredService = {
  service_id: string;
  price: number;
  delivery_time_days: number;
  features?: string[];
};

type StoredGig = {
  gig_id: string;
  title: string;
  cover_image_url: string;
  seller_id: string;
  services?: StoredService[];
};

function buildDemoGigDescriptionHtml(params: { title: string; category: string }) {
  const title = String(params.title || "");
  const category = String(params.category || "");

  const categoryBullets: Record<string, { what: string[]; process: string[]; idealFor: string[] }> = {
    "Graphics & Design": {
      what: [
        "Modern, brand-aligned design crafted from scratch",
        "High-resolution deliverables ready for web and print",
      ],
      process: [
        "Share your brand name, tagline, and style preferences",
        "I deliver initial concepts for review",
        "We refine and finalize the chosen direction",
      ],
      idealFor: ["Startups", "Personal brands", "Small businesses"],
    },
    "Programming & Tech": {
      what: [
        "Responsive, mobile-first UI",
        "Basic performance + SEO best practices",
      ],
      process: [
        "Share reference links and required pages/sections",
        "I build the UI and share progress updates",
        "We iterate and ship a production-ready result",
      ],
      idealFor: ["Landing pages", "Product sites", "Portfolio websites"],
    },
    "Digital Marketing": {
      what: [
        "Clear posting plan and simple brand voice guidance",
        "Engagement-focused hooks and captions",
      ],
      process: [
        "Share your niche, goals, and competitors",
        "I propose topics + content angles",
        "We refine and finalize your ready-to-post assets",
      ],
      idealFor: ["Instagram", "LinkedIn", "YouTube", "D2C brands"],
    },
    "Video & Animation": {
      what: [
        "Professional cuts, pacing, and clean transitions",
        "Basic color + audio cleanup (where applicable)",
        "Export settings optimized for your platform",
      ],
      process: [
        "Share footage + examples of the style you like",
        "I deliver a first cut",
        "We revise and export final versions",
      ],
      idealFor: ["Shorts/Reels", "YouTube", "Product videos"],
    },
    "Writing & Translation": {
      what: [
        "Human-sounding, clear writing with good structure",
        "SEO-friendly headings and readability",
        "Plagiarism-free, original work",
      ],
      process: [
        "Share your topic, audience, and keywords",
        "I deliver a draft",
        "We revise for tone and clarity",
      ],
      idealFor: ["Blogs", "Web pages", "Product descriptions"],
    },
  };

  const picked = categoryBullets[category] || categoryBullets["Programming & Tech"];

  const ul = (items: string[]) => `<ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul>`;

  return [
    `<p><strong>${title}</strong></p>`,
    `<p>I’ll deliver a polished result with clear communication, sensible revisions, and outputs ready to use.</p>`,
    `<h3>What you’ll get</h3>`,
    ul(picked.what),
    `<h3>How it works</h3>`,
    ul(picked.process),
    `<h3>Ideal for</h3>`,
    ul(picked.idealFor),
    `<p><em>Tip:</em> The more specific your requirements and references, the faster we can finalize.</p>`,
  ].join("");
}

function buildPackageFeatures(params: { category: string; tier: "basic" | "standard" | "premium" }) {
  const category = String(params.category || "");
  const tier = params.tier;

  const baseByCategory: Record<string, { basic: string[]; standard: string[]; premium: string[] }> = {
    "Graphics & Design": {
      basic: ["1 concept", "1 revision", "High-res PNG/JPG"],
      standard: ["2 concepts", "3 revisions", "High-res PNG/JPG", "Vector file (SVG)"],
      premium: ["3 concepts", "5 revisions", "High-res PNG/JPG", "Vector file (SVG)", "Mini brand kit (colors + fonts)", "Social media size exports"],
    },
    "Programming & Tech": {
      basic: ["Responsive layout", "Basic SEO structure", "Clean UI components"],
      standard: ["Up to 5 sections/pages", "Contact form integration", "Performance-friendly build"],
      premium: ["Multi-page site", "Animations/micro-interactions", "Analytics setup guidance", "Deployment support"],
    },
    "Digital Marketing": {
      basic: ["Content ideas", "Captions + hooks", "Basic hashtag research"],
      standard: ["7-day content plan", "Stronger CTAs", "Brand voice alignment"],
      premium: ["14-day content plan", "Carousel/script structure", "Optimization suggestions", "Repurposing guidance"],
    },
    "Video & Animation": {
      basic: ["Clean cuts + pacing", "Basic transitions", "1080p export"],
      standard: ["Color + audio cleanup", "Titles/lower-thirds", "Platform-ready formats"],
      premium: ["Advanced edits", "Motion graphics", "Multiple aspect ratios", "Priority export turnaround"],
    },
    "Writing & Translation": {
      basic: ["Well-structured draft", "Proofreading", "1 revision"],
      standard: ["SEO headings", "2 revisions", "Tone matching"],
      premium: ["SEO optimization", "3 revisions", "Internal linking suggestions", "Meta title/description"],
    },
  };

  const picked = baseByCategory[category] || baseByCategory["Programming & Tech"];
  return picked[tier];
}

const Gigs = () => {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("recommended");

  const baseGigs: GigItem[] = [
    {
      source: "base",
      id: "1",
      title: "I will design a modern minimalist logo for your brand",
      image: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&h=300&fit=crop",
      seller: { name: "Alex Chen", avatar: "", level: "Top Rated" },
      rating: 4.9,
      reviews: 324,
      price: 799,
      deliveryTime: "3 days",
      category: "Graphics & Design",
    },
    {
      source: "base",
      id: "2",
      title: "I will build a responsive React website with modern UI",
      image: "https://images.unsplash.com/photo-1547658719-da2b51169166?w=400&h=300&fit=crop",
      seller: { name: "Sarah Miller", avatar: "", level: "Level 2" },
      rating: 5.0,
      reviews: 186,
      price: 1499,
      deliveryTime: "7 days",
      category: "Programming & Tech",
    },
    {
      source: "base",
      id: "3",
      title: "I will create engaging social media content for your brand",
      image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop",
      seller: { name: "Mike Johnson", avatar: "", level: "Top Rated" },
      rating: 4.8,
      reviews: 512,
      price: 999,
      deliveryTime: "2 days",
      category: "Digital Marketing",
    },
    {
      source: "base",
      id: "4",
      title: "I will produce professional video editing and motion graphics",
      image: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=300&fit=crop",
      seller: { name: "Emma Davis", avatar: "", level: "Level 2" },
      rating: 4.9,
      reviews: 245,
      price: 1299,
      deliveryTime: "5 days",
      category: "Video & Animation",
    },
    {
      source: "base",
      id: "5",
      title: "I will write SEO-optimized blog posts and articles",
      image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=300&fit=crop",
      seller: { name: "James Wilson", avatar: "", level: "Level 1" },
      rating: 4.7,
      reviews: 89,
      price: 699,
      deliveryTime: "2 days",
      category: "Writing & Translation",
    },
    {
      source: "base",
      id: "6",
      title: "I will create a custom WordPress website for your business",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop",
      seller: { name: "Lisa Anderson", avatar: "", level: "Top Rated" },
      rating: 5.0,
      reviews: 412,
      price: 1499,
      deliveryTime: "10 days",
      category: "Programming & Tech",
    },
  ];

  const storedGigs = useMemo((): GigItem[] => {
    const list = listStoredGigs() as StoredGig[];
    return list.map((g) => {
      const services = Array.isArray(g.services) ? g.services : [];
      const prices = services.map((s) => Number(s.price)).filter((p) => Number.isFinite(p) && p > 0);
      const startingAt = prices.length ? Math.min(...prices) : 0;

      const deliveryDays = services
        .map((s) => Number(s.delivery_time_days))
        .filter((d) => Number.isFinite(d) && d > 0);
      const minDays = deliveryDays.length ? Math.min(...deliveryDays) : 0;

      const sellerShort = g.seller_id ? String(g.seller_id).slice(0, 8) : "Seller";

      return {
        source: "stored",
        id: String(g.gig_id),
        title: String(g.title || ""),
        image: String(g.cover_image_url || ""),
        seller: { name: sellerShort, avatar: "", level: "New" },
        rating: 0,
        reviews: 0,
        price: startingAt,
        deliveryTime: minDays ? `${minDays} day${minDays === 1 ? "" : "s"}` : "",
        category: "New",
      } satisfies GigItem;
    });
  }, []);

  function ensureGigIsStored(gig: GigItem) {
    if (gig.source !== "base") return;
    if (getStoredGig(gig.id)) return;

    const deliveryDays = Number(String(gig.deliveryTime || "").match(/\d+/)?.[0] || 0) || 3;
    const basePrice = Number(gig.price);
    const raw = Number.isFinite(basePrice) && basePrice > 0 ? basePrice : 999;
    const safeBasePrice = Math.max(499, Math.min(1499, Math.round(raw)));

    const services: StoredService[] = [
      {
        service_id: "basic",
        name: "Basic",
        price: Math.round(safeBasePrice),
        delivery_time_days: deliveryDays,
        features: buildPackageFeatures({ category: gig.category, tier: "basic" }),
      },
      {
        service_id: "standard",
        name: "Standard",
        price: Math.round(safeBasePrice * 1.5),
        delivery_time_days: Math.max(1, deliveryDays - 1),
        features: buildPackageFeatures({ category: gig.category, tier: "standard" }),
      },
      {
        service_id: "premium",
        name: "Premium",
        price: Math.round(safeBasePrice * 2),
        delivery_time_days: Math.max(1, deliveryDays - 2),
        features: buildPackageFeatures({ category: gig.category, tier: "premium" }),
      },
    ];

    upsertStoredGig({
      gig_id: String(gig.id),
      title: String(gig.title || ""),
      cover_image_url: String(gig.image || ""),
      seller_id: `demo_seller_${gig.id}`,
      services,
      description_html: buildDemoGigDescriptionHtml({ title: gig.title, category: gig.category }),
    });
  }

  const visibleGigs = useMemo((): GigItem[] => {
    let list = [...storedGigs, ...baseGigs];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) => g.title.toLowerCase().includes(q));
    }

    if (category) {
      list = list.filter((g) => g.category === category);
    }

    return list;
  }, [baseGigs, storedGigs, searchQuery, category]);

  const categories = [
    "All Categories",
    "Graphics & Design",
    "Programming & Tech",
    "Digital Marketing",
    "Video & Animation",
    "Writing & Translation",
    "Music & Audio",
    "Business",
  ];

  const sellerLevels = ["All Levels", "Top Rated", "Level 2", "Level 1", "New Seller"];
  const deliveryTimes = ["Any Time", "24 Hours", "3 Days", "7 Days", "14 Days"];

  const FilterSidebar = () => (
    <div className="space-y-6">
      {/* Category Filter */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Category</h3>
        <div className="space-y-2">
          {categories.map((cat) => (
            <label key={cat} className="flex items-center gap-2 cursor-pointer">
              <Checkbox id={cat} />
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {cat}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Seller Level Filter */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Seller Level</h3>
        <div className="space-y-2">
          {sellerLevels.map((level) => (
            <label key={level} className="flex items-center gap-2 cursor-pointer">
              <Checkbox id={level} />
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {level}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Delivery Time Filter */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Delivery Time</h3>
        <div className="space-y-2">
          {deliveryTimes.map((time) => (
            <label key={time} className="flex items-center gap-2 cursor-pointer">
              <Checkbox id={time} />
              <span className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {time}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Budget</h3>
        <div className="flex items-center gap-2">
          <Input type="number" placeholder="Min" className="h-9" />
          <span className="text-muted-foreground">-</span>
          <Input type="number" placeholder="Max" className="h-9" />
        </div>
        <Button variant="outline" size="sm" className="w-full mt-3">
          Apply
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>
          {searchQuery
            ? `${searchQuery} - Services on GigFlow`
            : category
            ? `${category} Services - GigFlow`
            : "Browse Services - GigFlow"}
        </title>
        <meta
          name="description"
          content="Find and hire talented freelancers for any project. Browse thousands of services in design, development, marketing, and more."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />

        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {searchQuery
                ? `Results for "${searchQuery}"`
                : category
                ? category
                : "All Services"}
            </h1>
            <p className="text-muted-foreground">
              {visibleGigs.length} services available
            </p>
          </div>

          <div className="flex gap-8">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24 bg-card rounded-xl border border-border p-6">
                <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </h2>
                <FilterSidebar />
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                  {/* Mobile Filter Button */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="lg:hidden">
                        <SlidersHorizontal className="w-4 h-4 mr-2" />
                        Filters
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80">
                      <SheetHeader>
                        <SheetTitle>Filters</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <FilterSidebar />
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* View Mode Toggle */}
                  <div className="flex items-center border border-border rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 rounded ${viewMode === "grid" ? "bg-muted" : ""}`}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 rounded ${viewMode === "list" ? "bg-muted" : ""}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="best-selling">Best Selling</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Gigs Grid */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`grid gap-6 ${
                  viewMode === "grid"
                    ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                    : "grid-cols-1"
                }`}
              >
                {visibleGigs.map((gig, index) => (
                  <motion.div
                    key={gig.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link to={`/gig/${gig.id}`} className="group block" onClick={() => ensureGigIsStored(gig)}>
                      <div className={`bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/30 transition-all duration-300 card-hover ${
                        viewMode === "list" ? "flex flex-col sm:flex-row" : ""
                      }`}>
                        {/* Image */}
                        <div className={`relative overflow-hidden ${
                          viewMode === "list" ? "w-full aspect-[4/3] sm:w-48 sm:aspect-auto shrink-0" : "aspect-[4/3]"
                        }`}>
                          <img
                            src={gig.image}
                            alt={gig.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors">
                            <Heart className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 flex-1">
                          {/* Seller Info */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {gig.seller.name}
                              </p>
                            </div>
                            <span className="text-xs font-medium text-primary bg-secondary px-2 py-0.5 rounded-full">
                              {gig.seller.level}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-medium text-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                            {gig.title}
                          </h3>

                          {/* Rating & Delivery */}
                          <div className="flex items-center gap-3 mb-3 text-sm">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-warning text-warning" />
                              <span className="font-semibold text-foreground">{gig.rating}</span>
                              <span className="text-muted-foreground">({gig.reviews})</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{gig.deliveryTime}</span>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="pt-3 border-t border-border">
                            <p className="text-sm text-muted-foreground">
                              Starting at{" "}
                              <span className="text-lg font-bold text-foreground">₹{gig.price}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-2 mt-12">
                <Button variant="outline" disabled>
                  Previous
                </Button>
                <Button variant="default">1</Button>
                <Button variant="outline">2</Button>
                <Button variant="outline">3</Button>
                <Button variant="outline">Next</Button>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Gigs;