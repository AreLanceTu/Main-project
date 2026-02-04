import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Mail, ArrowRight, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/firebase";
import { onAuthStateChanged, reload, sendEmailVerification, signOut } from "firebase/auth";
import { getUserRole, roleDefaultDashboardPath } from "@/auth/role";

export default function VerifyEmail() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);

      // If the user is already verified, no need to stay here.
      if (nextUser?.emailVerified) {
        const role = getUserRole(nextUser.uid);
        navigate(roleDefaultDashboardPath(role), { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate]);

  const handleResend = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "Sign in first so we can resend the verification email.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      await sendEmailVerification(user);
      toast({
        title: "Email Sent!",
        description: "We've sent a new verification link to your email.",
      });
    } catch (err) {
      toast({
        title: "Couldn't resend email",
        description: err?.message ?? "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleIHaveVerified = async () => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    setIsChecking(true);
    try {
      // Refresh user state from Firebase.
      await reload(user);

      if (auth.currentUser?.emailVerified) {
        toast({
          title: "Email verified",
          description: "You're all set.",
        });
        const role = getUserRole(auth.currentUser.uid);
        navigate(roleDefaultDashboardPath(role), { replace: true });
        return;
      }

      toast({
        title: "Not verified yet",
        description: "Please click the verification link in your email, then try again.",
        variant: "destructive",
      });
    } catch (err) {
      toast({
        title: "Couldn't check verification",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Verify Your Email - GigFlow</title>
        <meta
          name="description"
          content="Please verify your email address to complete your GigFlow registration."
        />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-surface">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md text-center"
        >
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">G</span>
            </div>
            <span className="text-2xl font-bold text-foreground">GigFlow</span>
          </Link>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-24 h-24 rounded-full bg-secondary mx-auto mb-8 flex items-center justify-center"
          >
            <Mail className="w-12 h-12 text-primary" />
          </motion.div>

          <h1 className="text-3xl font-bold text-foreground mb-3">Check your email</h1>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            We sent a verification link to {user?.email ? (
              <span className="font-medium text-foreground">{user.email}</span>
            ) : (
              "your email address"
            )}. Click the link to verify your account.
          </p>

          <div className="space-y-3">
            <Button variant="hero" size="lg" className="w-full" asChild>
              <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer">
                Open Email App
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleResend}
              disabled={isSending}
              type="button"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              {isSending ? "Sending..." : "Resend Verification Email"}
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={handleIHaveVerified}
              disabled={isChecking}
              type="button"
            >
              {isChecking ? "Checking..." : "I've verified my email"}
            </Button>

            {user ? (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => signOut(auth)}
                type="button"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            ) : null}
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            Didn’t receive the email? Check your spam folder.
          </p>

          <p className="mt-6">
            <Link to="/login" className="text-primary font-medium hover:underline">
              ← Back to Sign In
            </Link>
          </p>
        </motion.div>
      </div>
    </>
  );
}
