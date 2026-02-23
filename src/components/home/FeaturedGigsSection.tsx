import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Heart, Clock, ArrowRight } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { getStoredGig, upsertStoredGig } from "@/lib/gigStore";
import { migrateStoredDemoGigsToSellerUid } from "@/lib/demoGigs";
import { getDemoSellerIdForGigId, getDemoSellerUid } from "@/lib/demoSeller";

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
  reviews: number;
  price: number;
  deliveryTime: string;
  category: string;
}

function buildDemoDescriptionHtml({ title, category }: { title: string; category: string }) {
  const safeTitle = String(title || "");
  const safeCategory = String(category || "");
  return `
    <div>
      <p><strong>${safeTitle}</strong></p>
      <p>Category: ${safeCategory}</p>
      <p>This is a demo listing. Packages below show pricing and delivery options.</p>
    </div>
  `.trim();
}

function ensureFeaturedGigIsStored(gig: Gig) {
  if (!gig?.id) return;
  if (getStoredGig(gig.id)) return;

  const deliveryDays = Number(String(gig.deliveryTime || "").match(/\d+/)?.[0] || 0) || 3;
  const basePrice = Number(gig.price);
  const safeBasePrice =
    Number.isFinite(basePrice) && basePrice > 0 ? Math.round(basePrice) : 799;

  upsertStoredGig({
    gig_id: String(gig.id),
    title: String(gig.title || ""),
    cover_image_url: String(gig.image || ""),
    seller_id: getDemoSellerIdForGigId(gig.id),
    description_html: buildDemoDescriptionHtml({ title: gig.title, category: gig.category }),
    services: [
      {
        service_id: "basic",
        name: "Basic",
        price: Math.round(safeBasePrice),
        delivery_time_days: deliveryDays,
        features: ["1 concept", "1 revision", "Source file included"],
      },
      {
        service_id: "standard",
        name: "Standard",
        price: Math.round(safeBasePrice * 1.5),
        delivery_time_days: Math.max(1, deliveryDays - 1),
        features: ["2 concepts", "3 revisions", "Source file included"],
      },
      {
        service_id: "premium",
        name: "Premium",
        price: Math.round(safeBasePrice * 2),
        delivery_time_days: Math.max(1, deliveryDays - 2),
        features: ["3 concepts", "Unlimited revisions", "Priority support"],
      },
    ],
  });
}

const FeaturedGigsSection = () => {
  const demoSellerUid = useMemo(() => getDemoSellerUid(), []);

  useEffect(() => {
    if (!demoSellerUid) return;
    migrateStoredDemoGigsToSellerUid(demoSellerUid);
  }, [demoSellerUid]);

  const featuredGigs: Gig[] = [
    {
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
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <section className="py-20 lg:py-28 bg-surface">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12"
        >
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Featured Services
            </h2>
            <p className="text-muted-foreground">
              Hand-picked services from our top-rated freelancers
            </p>
          </div>
          <Button variant="outline" asChild className="self-start md:self-auto">
            <Link to="/gigs">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </motion.div>

        {/* Gigs Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {featuredGigs.map((gig) => (
            <motion.div key={gig.id} variants={itemVariants}>
              <Link
                to={`/gig/${gig.id}`}
                className="group block"
                onClick={() => ensureFeaturedGigIsStored(gig)}
              >
                <div className="bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/30 transition-all duration-300 card-hover">
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={gig.image}
                      alt={gig.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors">
                      <Heart className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                    <span className="absolute top-3 left-3 px-2 py-1 rounded-md bg-card/80 backdrop-blur-sm text-xs font-medium">
                      {gig.category}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-4">
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
                    <h3 className="text-sm font-medium text-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors min-h-[40px]">
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
                        <span className="text-lg font-bold text-foreground">
                          ₹{gig.price}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedGigsSection;