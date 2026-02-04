import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { auth } from "@/firebase";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createWithdrawal } from "@/lib/withdrawals";

function parseBankDestination(raw) {
  const s = String(raw || "").trim();
  if (!s) return { bankAccountNumber: "", ifsc: "" };

  // Accept common user inputs:
  // - "1234567890 / IFSC0001234"
  // - "1234567890 IFSC0001234"
  // - "1234567890,IFSC0001234"
  const parts = s
    .split(/\s*[/,\s]+\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    bankAccountNumber: parts[0] || "",
    ifsc: (parts[1] || "").toUpperCase(),
  };
}

export default function WithdrawalDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [userUid, setUserUid] = useState(null);
  const [amount, setAmount] = useState(() => {
    const a = Number(location.state?.amount);
    return Number.isFinite(a) ? a : 0;
  });
  const [available, setAvailable] = useState(() => {
    const a = Number(location.state?.available);
    return Number.isFinite(a) ? a : 0;
  });

  const [method, setMethod] = useState("bank");
  const [accountName, setAccountName] = useState("");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserUid(u?.uid ?? null);
    });
    return unsub;
  }, []);

  const canSubmit = useMemo(() => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return false;
    if (available && amt > available) return false;
    if (!method) return false;
    if (!destination.trim()) return false;
    if (!accountName.trim()) return false;
    if (method === "bank") {
      const parsed = parseBankDestination(destination);
      if (!parsed.bankAccountNumber || !parsed.ifsc) return false;
    }
    return true;
  }, [amount, available, method, destination, accountName]);

  function onCancel() {
    navigate("/freelancer-dashboard");
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    const user = auth.currentUser;
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to request a withdrawal.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    setSubmitting(true);
    try {
      const amt = Number(amount);

      const basePayload = {
        amount: amt,
        method,
        accountHolderName: accountName.trim(),
      };

      const payload =
        method === "upi"
          ? { ...basePayload, upiId: destination.trim() }
          : { ...basePayload, ...parseBankDestination(destination) };

      await createWithdrawal(payload);

      toast({
        title: "Withdrawal requested",
        description: "Your payout is being processed. You can track it in Withdrawals.",
      });

      navigate("/freelancer-dashboard", { replace: true });
    } catch (err) {
      toast({
        title: "Could not request withdrawal",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Withdrawal Details - GigFlow</title>
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="w-full px-4 py-6 sm:py-8">
          <div className="mx-auto w-full max-w-[1200px]">
            <Card className="mx-auto w-full max-w-xl">
              <CardHeader>
                <CardTitle>Withdrawal details</CardTitle>
                <CardDescription>Choose where you want to receive your payout.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Method</Label>
                      <Select value={method} onValueChange={setMethod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">Bank transfer</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="withdraw-amount">Amount</Label>
                      <Input
                        id="withdraw-amount"
                        type="number"
                        min={1}
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                      />
                      {available ? (
                        <p className="text-xs text-muted-foreground">Available: {available}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-name">Account holder name</Label>
                    <Input
                      id="account-name"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="e.g. John Doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="destination">
                      {method === "upi"
                        ? "UPI ID"
                        : "Bank details"}
                    </Label>
                    <Input
                      id="destination"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder={
                        method === "upi"
                          ? "name@bank"
                          : "Account number / IFSC"
                      }
                    />
                  </div>

                  <div className="flex items-center justify-end gap-4">
                    <Button type="button" variant="outline" onClick={onCancel}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!canSubmit || submitting}>
                      {submitting ? "Submitting..." : "Continue"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
