import { Helmet } from "react-helmet-async";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "@/firebase";
import { getUserRole, setUserRole } from "@/auth/role";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ensureFreelancerEligibility } from "@/lib/geo";

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userUid, setUserUid] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserUid(u?.uid ?? null);
      setRole(u?.uid ? getUserRole(u.uid) : null);
    });
    return unsub;
  }, []);

  const effectiveRole = role ?? "client";

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
    setRole("freelancer");
    navigate("/freelancer-dashboard");
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - GigFlow</title>
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            You’re signed in as a {effectiveRole}.
          </p>

          {effectiveRole !== "freelancer" ? (
            <div className="mt-6">
              <Button onClick={() => void switchToFreelancer()}>Switch to freelancer dashboard</Button>
            </div>
          ) : (
            <div className="mt-6">
              <Button onClick={() => navigate("/freelancer-dashboard")}>Go to freelancer dashboard</Button>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
}
