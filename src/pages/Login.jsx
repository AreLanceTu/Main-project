import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "@/firebase";
import { getUserRole, roleDefaultDashboardPath, consumePendingRole, setUserRole } from "@/auth/role";
import { ensureUserProfile } from "@/lib/userProfile";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const nextPath = useMemo(() => {
    // AuthGuard sets state.from when it redirects to /login.
    return location.state?.from || null;
  }, [location.state]);

  const navigateAfterLogin = (user) => {
    // If the guard asked us to return to a specific protected URL, honor it.
    if (nextPath) {
      navigate(nextPath, { replace: true });
      return;
    }

    // Otherwise, route by role.
    const role = getUserRole(user?.uid);
    navigate(roleDefaultDashboardPath(role), { replace: true });
  };

  const handleContinueWithGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);

      // If a role was selected earlier (e.g. from Register), persist it for this user.
      const pendingRole = consumePendingRole();
      if (pendingRole) {
        setUserRole(credential.user.uid, pendingRole);
      }

      // Ensure Firestore user profile exists for username search.
      try {
        await ensureUserProfile(db, credential.user, {
          role: pendingRole || getUserRole(credential.user.uid) || undefined,
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
        title: "Login Successful",
        description: "Welcome back to GigFlow!",
      });
      navigateAfterLogin(credential.user);
    } catch (err) {
      toast({
        title: "Google sign-in failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      // Enforce verification before allowing access to protected routes.
      if (!user.emailVerified) {
        toast({
          title: "Email not verified",
          description: "Please verify your email before logging in.",
          variant: "destructive",
        });
        navigate("/verify-email", { replace: true });
        return;
      }

      toast({
        title: "Login Successful",
        description: "Welcome back to GigFlow!",
      });

      // Ensure Firestore user profile exists (fills username if missing).
      try {
        await ensureUserProfile(db, user, {
          role: getUserRole(user.uid) || undefined,
          fullName: user.displayName || "",
        });
      } catch (e) {
        console.error("Failed to ensure user profile", e);
      }

      navigateAfterLogin(user);
    } catch (err) {
      toast({
        title: "Login failed",
        description: err?.message ?? "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Sign In - GigFlow</title>
        <meta
          name="description"
          content="Sign in to your GigFlow account to access your dashboard, manage gigs, and connect with freelancers."
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

            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Welcome back
              </h1>
              <p className="text-muted-foreground">
                Sign in to your account to continue
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
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In
                    <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>
            </form>

            <p className="mt-8 text-center text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-primary font-semibold hover:underline"
              >
                Sign up for free
              </Link>
            </p>
          </motion.div>
        </div>

        <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary via-primary to-primary-hover items-center justify-center p-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-32 h-32 border-2 border-primary-foreground rounded-full" />
            <div className="absolute bottom-20 right-20 w-48 h-48 border-2 border-primary-foreground rounded-full" />
            <div className="absolute top-1/2 left-1/3 w-20 h-20 border-2 border-primary-foreground rounded-full" />
          </div>

          <div className="relative z-10 text-center text-primary-foreground max-w-md">
            <h2 className="text-4xl font-bold mb-6">
              Find the perfect talent for your project
            </h2>
            <p className="text-lg opacity-90 mb-8">
              Connect with thousands of skilled freelancers ready to bring your
              ideas to life.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
