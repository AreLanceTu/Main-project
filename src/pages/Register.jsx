import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  roleDefaultDashboardPath,
  setUserRole,
} from "@/auth/role";
import { ensureUserProfile, isValidUsername, normalizeUsername } from "@/lib/userProfile";

export default function Register() {
  // Users always register as a client. Freelancer is an upgrade after login (India-only).
  const role = "client";
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

  const handleContinueWithGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);

      setUserRole(credential.user.uid, role);

      // Ensure Firestore user profile exists (for chat search by username).
      try {
        await ensureUserProfile(db, credential.user, {
          role,
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
      navigate(roleDefaultDashboardPath(role), { replace: true });
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

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Create your account
                </h1>
                <p className="text-muted-foreground">
                  Create a client account. You can become a freelancer after login (India only).
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
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
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
