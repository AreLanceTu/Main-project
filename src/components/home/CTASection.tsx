import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase";
import { getUserRole, setUserRole } from "@/auth/role";
import { useToast } from "@/hooks/use-toast";
import { ensureFreelancerEligibility } from "@/lib/geo";

const CTASection = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userRole, setUserRoleState] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserUid(u?.uid ?? null);
      setUserRoleState(u?.uid ? getUserRole(u.uid) : null);
    });
    return unsub;
  }, []);

  const effectiveRole = useMemo(() => userRole ?? "client", [userRole]);

  const switchToFreelancer = async () => {
    if (!userUid) return;

    const check = await ensureFreelancerEligibility();
    if (!check.ok) {
      toast({
        title: check.reason === "not_india" ? "Freelancer access restricted" : "Couldn’t verify your location",
        description:
          check.reason === "not_india"
            ? "To use the freelancer dashboard, you must be in India (based on your IP address)."
            : "We couldn’t detect your country from your IP. Please try again (and disable ad-blockers/VPN if enabled).",
        variant: "destructive",
      });
      return;
    }

    setUserRole(userUid, "freelancer");
    setUserRoleState("freelancer");
    navigate("/freelancer-dashboard");
  };

  const goToFreelancerDashboard = () => {
    navigate("/freelancer-dashboard");
  };

  return (
    <section className="py-20 lg:py-28 bg-gradient-to-br from-secondary via-background to-secondary/50 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
          >
            <Sparkles className="w-4 h-4" />
            Start Your Journey Today
          </motion.div>

          {/* Heading */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight"
          >
            Ready to bring your{" "}
            <span className="text-gradient">ideas to life</span>?
          </motion.h2>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto"
          >
            Join millions of users who trust GigFlow to connect with talented
            freelancers and grow their business. Sign up today and get started in
            minutes.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button variant="hero" size="xl" asChild>
              <Link to="/register">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>

            {userUid ? (
              effectiveRole === "freelancer" ? (
                <Button variant="outline" size="xl" onClick={goToFreelancerDashboard}>
                  Go to freelancer dashboard
                </Button>
              ) : (
                <Button variant="outline" size="xl" onClick={switchToFreelancer}>
                  Switch to freelancer dashboard
                </Button>
              )
            ) : (
              <Button variant="outline" size="xl" asChild>
                <Link to="/register?role=freelancer">Become a Seller</Link>
              </Button>
            )}
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Free to sign up
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Cancel anytime
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;