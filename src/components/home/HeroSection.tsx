import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ArrowRight, Star, Users, Briefcase, Shield, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const HeroSection = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/gigs?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const popularServices = [
    "Logo Design",
    "WordPress",
    "Voice Over",
    "Video Editing",
    "Social Media",
  ];

  const stats = [
    { icon: Users, value: "50K+", label: "Freelancers" },
    { icon: Briefcase, value: "100K+", label: "Orders" },
    { icon: Star, value: "4.9", label: "Avg rating" },
    { icon: Shield, value: "Secure", label: "Payments" },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-surface via-background to-secondary/30">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-20 lg:py-32 relative z-10">
        <div className="mx-auto w-full max-w-6xl grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Trusted marketplace • Verified sellers • Secure payments
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6"
            >
              Find the perfect{" "}
              <span className="text-gradient">freelance</span>{" "}
              services for your business
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0"
            >
              Hire skilled freelancers for design, development, marketing, and writing—
              with clear packages, transparent pricing, and secure checkout.
            </motion.p>

            {/* Search Bar */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onSubmit={handleSearch}
              className="mb-6"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Try 'logo design' or 'web development'"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-14 pl-12 pr-4 text-base bg-card border-2 border-border focus:border-primary rounded-xl shadow-sm"
                  />
                </div>
                <Button type="submit" variant="hero" size="xl" className="shrink-0">
                  Search
                  <ArrowRight className="w-5 h-5 ml-1" />
                </Button>
              </div>
            </motion.form>

            {/* Popular Services */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-2"
            >
              <span className="text-sm text-muted-foreground">Popular:</span>
              {popularServices.map((service) => (
                <button
                  key={service}
                  onClick={() => navigate(`/gigs?search=${encodeURIComponent(service)}`)}
                  className="px-3 py-1.5 text-sm bg-card border border-border hover:border-primary/50 hover:bg-secondary rounded-full transition-all"
                >
                  {service}
                </button>
              ))}
            </motion.div>

            {/* Trust + Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mt-8"
            >
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck className="h-4 w-4" />
                  Verified sellers
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Shield className="h-4 w-4" />
                  Secure checkout
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  4.9 average rating
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border bg-card/60 px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <stat.icon className="h-4 w-4" />
                      <span className="text-xs">{stat.label}</span>
                    </div>
                    <div className="mt-1 text-lg font-semibold text-foreground">{stat.value}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right Content - Banner Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="aspect-[16/9]">
                <img
                  src="/mock-service-banner.svg"
                  alt="GigFlow marketplace preview"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-card/60 p-4">
                <div className="text-sm font-medium text-foreground">Clear packages</div>
                <div className="text-sm text-muted-foreground">Choose Basic, Standard, or Premium</div>
              </div>
              <div className="rounded-xl border bg-card/60 p-4">
                <div className="text-sm font-medium text-foreground">Buyer protection</div>
                <div className="text-sm text-muted-foreground">Secure payments and support</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;