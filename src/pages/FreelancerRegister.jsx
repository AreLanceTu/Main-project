import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth, db } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { registerAsFreelancer } from "@/lib/freelancers";
import { ensureFreelancerEligibility } from "@/lib/geo";

export default function FreelancerRegister() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [uid, setUid] = useState(null);
  const [checking, setChecking] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [geoChecking, setGeoChecking] = useState(true);
  const [geoDenied, setGeoDenied] = useState(false);
  const [geoMessage, setGeoMessage] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    title: "",
    bio: "",
    city: "",
    state: "",
    primaryCategory: "",
    skillsCsv: "",
    portfolioUrl: "",
  });

  useEffect(() => {
    let unsubReg = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setChecking(true);
      setRegistered(false);

      if (unsubReg) {
        unsubReg();
        unsubReg = null;
      }

      if (!u) {
        setUid(null);
        setChecking(false);
        return;
      }

      setUid(u.uid);

      // Prefill from auth profile when available.
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || (u.displayName ?? ""),
      }));

      unsubReg = onSnapshot(
        doc(db, "freelancers", u.uid),
        (snap) => {
          const ok = snap.exists();
          setRegistered(ok);
          setChecking(false);
          if (ok) navigate("/freelancer-dashboard", { replace: true });
        },
        () => {
          setRegistered(false);
          setChecking(false);
        },
      );
    });

    return () => {
      if (unsubReg) unsubReg();
      unsubAuth();
    };
  }, [navigate]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setGeoChecking(true);
      setGeoDenied(false);
      setGeoMessage("");

      // Force a fresh check here (don't trust sessionStorage cache).
      const res = await ensureFreelancerEligibility({ useCache: false });
      if (!alive) return;

      if (res.ok) {
        setGeoDenied(false);
        setGeoMessage("");
      } else {
        setGeoDenied(true);
        if (res.reason === "not_india") {
          setGeoMessage("Freelancer registration is only available in India (based on your IP address).");
        } else {
          setGeoMessage("We couldn’t verify your country from your IP. Disable VPN/ad-blockers and try again.");
        }
      }
      setGeoChecking(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const canSubmit = useMemo(
    () => !!uid && !checking && !registered && !geoChecking && !geoDenied && !submitting,
    [uid, checking, registered, geoChecking, geoDenied, submitting],
  );

  const handleRegister = async () => {
    if (!uid) return;

    setSubmitting(true);
    try {
      const skills = form.skillsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await registerAsFreelancer(db, uid, {
        fullName: form.fullName,
        phone: form.phone,
        title: form.title,
        bio: form.bio,
        city: form.city,
        state: form.state,
        primaryCategory: form.primaryCategory || undefined,
        skills: skills.length ? skills : undefined,
        portfolioUrl: form.portfolioUrl || undefined,
      });
      // The snapshot will navigate after doc exists.
      toast({
        title: "Registered as freelancer",
        description: "Redirecting to your freelancer dashboard...",
      });
    } catch (e) {
      toast({
        title: "Could not register",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return null;

  if (!uid) {
    // AuthGuard should prevent this, but keep it safe.
    navigate("/login", { replace: true });
    return null;
  }

  if (geoChecking) return null;

  if (geoDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Freelancer registration</h1>
            <p className="text-muted-foreground mt-2">{geoMessage}</p>
          </div>

          <Button className="w-full" variant="outline" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Freelancer registration</h1>
          <p className="text-muted-foreground mt-2">
            Fill in the required details to unlock the freelancer dashboard.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="Your name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="e.g. +91 98xxxxxx"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Professional title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Full‑stack developer"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Primary category</Label>
            <Select
              value={form.primaryCategory}
              onValueChange={(v) => setForm((p) => ({ ...p, primaryCategory: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Graphics & Design">Graphics & Design</SelectItem>
                <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                <SelectItem value="Writing & Translation">Writing & Translation</SelectItem>
                <SelectItem value="Video & Animation">Video & Animation</SelectItem>
                <SelectItem value="Programming & Tech">Programming & Tech</SelectItem>
                <SelectItem value="Business">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skills">Skills (comma separated)</Label>
            <Input
              id="skills"
              value={form.skillsCsv}
              onChange={(e) => setForm((p) => ({ ...p, skillsCsv: e.target.value }))}
              placeholder="e.g. React, Node.js, Firebase"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="portfolioUrl">Portfolio URL (optional)</Label>
            <Input
              id="portfolioUrl"
              value={form.portfolioUrl}
              onChange={(e) => setForm((p) => ({ ...p, portfolioUrl: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="City"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                placeholder="State"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder="Tell clients about your experience and what you offer..."
              required
            />
            <div className="text-xs text-muted-foreground">Minimum 30 characters.</div>
          </div>
        </div>

        <Button className="w-full" variant="hero" size="lg" onClick={handleRegister} disabled={!canSubmit}>
          {submitting ? "Registering..." : "Submit registration"}
        </Button>

        <Button className="w-full" variant="outline" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
