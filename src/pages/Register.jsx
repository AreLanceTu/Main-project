import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Chrome,
  Briefcase,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "@/firebase";
import {
  consumePendingRole,
  roleDefaultDashboardPath,
  setPendingRole,
  setUserRole,
} from "@/auth/role";
import { ensureUserProfile, isValidUsername, normalizeUsername } from "@/lib/userProfile";

export default function Register() {
  const [step, setStep] = useState("role");
  const [role, setRole] = useState(null);
  const [isRoleChecking, setIsRoleChecking] = useState(false);
  const [geoDebug, setGeoDebug] = useState(null);
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const resolveCountryCode = async () => {
    const cached = sessionStorage.getItem("geo_country_code");
    const cachedProvider = sessionStorage.getItem("geo_provider");
    const cachedIp = sessionStorage.getItem("geo_ip");
    if (cached) {
      return { countryCode: cached, provider: cachedProvider || "cache", ip: cachedIp || null };
    }

    const fetchJsonWithTimeout = async (url) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const providers = [
      {
        name: "country.is",
        url: "https://api.country.is/",
        pick: (d) => d?.country ?? null,
        ip: (d) => d?.ip ?? null,
        error: (d) => d?.message,
      },
      {
        name: "ipwho.is",
        url: "https://ipwho.is/?fields=success,message,country_code",
        pick: (d) => (d?.success ? d?.country_code : null),
        ip: (d) => d?.ip ?? null,
        error: (d) => d?.message,
      },
      {
        name: "ipapi.co",
        url: "https://ipapi.co/json/",
        pick: (d) => d?.country_code ?? null,
        ip: (d) => d?.ip ?? null,
        error: (d) => d?.error ? String(d?.reason ?? "Geo lookup failed") : null,
      },
      {
        name: "freeipapi.com",
        url: "https://freeipapi.com/api/json/",
        pick: (d) => d?.countryCode ?? null,
        ip: (d) => d?.ipAddress ?? d?.ip ?? null,
        error: (d) => d?.message,
      },
    ];

    let lastError = "";
    for (const p of providers) {
      try {
        const data = await fetchJsonWithTimeout(p.url);
        const code = p.pick(data);
        if (code) {
          const ip = typeof p.ip === "function" ? p.ip(data) : null;
          sessionStorage.setItem("geo_country_code", code);
          sessionStorage.setItem("geo_provider", p.name);
          if (ip) sessionStorage.setItem("geo_ip", ip);
          return { countryCode: code, provider: p.name, ip };
        }
        lastError = p.error(data) || lastError;
      } catch (err) {
        lastError = err?.message || String(err);
      }
    }

    return { countryCode: null, provider: null, ip: null, error: lastError || "Geo lookup failed" };
  };

  const ensureFreelancerEligibilityOrToast = async () => {
    setIsRoleChecking(true);
    try {
      const result = await resolveCountryCode();
      if (import.meta?.env?.DEV) {
        setGeoDebug(result);
        // eslint-disable-next-line no-console
        console.info("[geo] result", result);
      }

      const { countryCode } = result;
      if (!countryCode) {
        toast({
          title: "Couldn’t verify your location",
          description:
            "We couldn’t detect your country from your IP. Please try again (and disable ad-blockers/VPN if enabled).",
          variant: "destructive",
        });
        return false;
      }

      if (countryCode !== "IN") {
        toast({
          title: "Freelancer sign-up restricted",
          description: "To register as a freelancer, you must be in India (based on your IP address).",
          variant: "destructive",
        });
        return false;
      }
      return true;
    } finally {
      setIsRoleChecking(false);
    }
  };

  useEffect(() => {
    const roleFromUrl = searchParams.get("role");
    if (roleFromUrl !== "freelancer" && roleFromUrl !== "client") return;

    (async () => {
      if (roleFromUrl === "freelancer") {
        const ok = await ensureFreelancerEligibilityOrToast();
        if (!ok) {
          setRole(null);
          setStep("role");
          return;
        }
      }
      setRole(roleFromUrl);
      setStep("form");
    })();
  }, [searchParams]);

  const handleRoleSelect = async (selectedRole) => {
    if (selectedRole === "freelancer") {
      const ok = await ensureFreelancerEligibilityOrToast();
      if (!ok) return;
    }

    setRole(selectedRole);
    setStep("form");
  };

  const handleContinueWithGoogle = async () => {
    // Role selection is app-specific; keep it but store locally.
    if (!role) {
      toast({
        title: "Select your role first",
        description: "Choose client or freelancer before continuing with Google.",
        variant: "destructive",
      });
      return;
    }

    if (role === "freelancer") {
      const ok = await ensureFreelancerEligibilityOrToast();
      if (!ok) return;
    }

    setIsGoogleLoading(true);
    try {
      setPendingRole(role);

      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);

      // Persist role for the created/signed-in user.
      const pendingRole = consumePendingRole() || role;
      if (pendingRole) {
        setUserRole(credential.user.uid, pendingRole);
      }

      // Ensure Firestore user profile exists (for chat search by username).
      try {
        await ensureUserProfile(db, credential.user, {
          role: pendingRole,
          fullName: credential.user.displayName || "",
        });
      } catch (e) {
        console.error("Failed to ensure user profile", e);
      }

      // Google users are typically verified by provider.
      if (!credential.user.emailVerified) {
        navigate("/verify-email", { replace: true });
        return;
      }

      toast({
        title: "Account Created!",
        description: "Welcome to GigFlow.",
      });
      navigate(roleDefaultDashboardPath(pendingRole), { replace: true });
    } catch (err) {
      toast({
        title: "Google sign-up failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (!role) {
      toast({
        title: "Select your role first",
        description: "Choose client or freelancer to continue.",
        variant: "destructive",
      });
      return;
    }

    if (role === "freelancer") {
      const ok = await ensureFreelancerEligibilityOrToast();
      if (!ok) return;
    }

    setIsLoading(true);

    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Persist app role selection locally for routing.
      setUserRole(user.uid, role);

      // Optional: store the name on the Firebase Auth profile.
      if (formData.fullName) {
        await updateProfile(user, { displayName: formData.fullName });
      }

      // Persist a Firestore profile so users can be found by username.
      const desiredUsername = normalizeUsername(formData.username);
      if (desiredUsername && !isValidUsername(desiredUsername)) {
        toast({
          title: "Invalid username",
          description: "Use 3-20 chars: letters/numbers/._ and no spaces.",
          variant: "destructive",
        });
      }

      await ensureUserProfile(db, user, {
        role,
        fullName: formData.fullName,
        username: desiredUsername || undefined,
      });

      // Firebase sends the verification email.
      await sendEmailVerification(user);

      toast({
        title: "Account Created!",
        description: "Please check your email to verify your account.",
      });

      // User must verify before accessing protected routes.
      navigate("/verify-email", { replace: true });
    } catch (err) {
      toast({
        title: "Registration failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Create Account - GigFlow</title>
        <meta
          name="description"
          content="Join GigFlow today. Create your free account to hire freelancers or start selling your services."
        />
      </Helmet>

      <div className="min-h-screen flex">
        <div className="flex-1 flex items-center justify-center px-4 py-12 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <Link to="/" className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">
                  G
                </span>
              </div>
              <span className="text-2xl font-bold text-foreground">GigFlow</span>
            </Link>

            {step === "role" ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Join GigFlow
                  </h1>
                  <p className="text-muted-foreground">
                    How do you want to use GigFlow?
                  </p>
                </div>

                <div className="space-y-4">
                  {isRoleChecking ? (
                    <div className="text-sm text-muted-foreground">
                      Checking your location…
                    </div>
                  ) : null}

                  {import.meta?.env?.DEV && geoDebug ? (
                    <div className="text-xs text-muted-foreground">
                      Geo debug: {geoDebug?.countryCode ?? "?"}
                      {geoDebug?.ip ? ` · ${geoDebug.ip}` : ""}
                      {geoDebug?.provider ? ` · via ${geoDebug.provider}` : ""}
                      {geoDebug?.error ? ` · error: ${geoDebug.error}` : ""}
                    </div>
                  ) : null}
                  <button
                    onClick={() => handleRoleSelect("client")}
                    className="w-full p-6 rounded-2xl border-2 border-border hover:border-primary bg-card hover:bg-secondary transition-all text-left group"
                    type="button"
                    disabled={isRoleChecking}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-secondary group-hover:bg-primary flex items-center justify-center transition-colors">
                        <Briefcase className="w-7 h-7 text-primary group-hover:text-primary-foreground transition-colors" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-1">
                          I'm a client, hiring for a project
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Find and hire talented freelancers for your business
                          needs
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleRoleSelect("freelancer")}
                    className="w-full p-6 rounded-2xl border-2 border-border hover:border-primary bg-card hover:bg-secondary transition-all text-left group"
                    type="button"
                    disabled={isRoleChecking}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-secondary group-hover:bg-primary flex items-center justify-center transition-colors">
                        <UserCircle className="w-7 h-7 text-primary group-hover:text-primary-foreground transition-colors" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-1">
                          I'm a freelancer, looking for work
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Showcase your skills and start earning on your own
                          terms
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <p className="mt-8 text-center text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <button
                  onClick={() => setStep("role")}
                  className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1"
                  type="button"
                >
                  ← Back to role selection
                </button>

                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    Create your account
                  </h1>
                  <p className="text-muted-foreground">
                    {role === "client"
                      ? "Start hiring talented freelancers today"
                      : "Begin your freelancing journey with GigFlow"}
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full h-12 mb-6"
                  type="button"
                  onClick={handleContinueWithGoogle}
                  disabled={isGoogleLoading}
                >
                  <Chrome className="w-5 h-5 mr-2" />
                  {isGoogleLoading ? "Connecting..." : "Continue with Google"}
                </Button>

                <div className="relative mb-6">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-4 text-sm text-muted-foreground">
                    or continue with email
                  </span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                        className="pl-10 h-12"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="username"
                        type="text"
                        placeholder="e.g. akash.dev"
                        value={formData.username}
                        onChange={(e) =>
                          setFormData({ ...formData, username: e.target.value })
                        }
                        className="pl-10 h-12"
                        required
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      This is how others will find you in Messages.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="pl-10 h-12"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        className="pl-10 pr-10 h-12"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            confirmPassword: e.target.value,
                          })
                        }
                        className="pl-10 h-12"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin h-5 w-5"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Creating account...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Create Account
                        <ArrowRight className="w-5 h-5" />
                      </span>
                    )}
                  </Button>
                </form>

                <p className="mt-8 text-center text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="text-primary font-semibold hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>

        <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary via-primary to-primary-hover items-center justify-center p-12 relative overflow-hidden">
          <div className="relative z-10 text-center text-primary-foreground max-w-md">
            <h2 className="text-4xl font-bold mb-6">Join a growing community</h2>
            <p className="text-lg opacity-90">
              Create an account, verify your email, and start using GigFlow.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
