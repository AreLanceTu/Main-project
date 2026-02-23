import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, sendEmailVerification, updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { auth, db } from "@/firebase";
import { getUserRole } from "@/auth/role";
import { supabase } from "@/supabase";
import { isValidUsername, normalizeUsername } from "@/lib/userProfile";
import { openRazorpayCheckout, verifyRazorpayPayment } from "@/lib/payments";
import { getMySubscriptionStatus } from "@/lib/subscriptions";
import { getMyPaymentOrders } from "@/lib/paymentOrders";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function Account() {
  const { toast } = useToast();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [photoUrlDraft, setPhotoUrlDraft] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingVerify, setSendingVerify] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [username, setUsername] = useState(null);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState(null);
  const [usernameSuccess, setUsernameSuccess] = useState(null);

  const [proActive, setProActive] = useState(false);
  const [verifiedBadge, setVerifiedBadge] = useState(false);
  const [proEndsAt, setProEndsAt] = useState(null);
  const [upgradingPro, setUpgradingPro] = useState(false);

  const [paymentOrders, setPaymentOrders] = useState([]);
  const [paymentOrdersLoading, setPaymentOrdersLoading] = useState(false);
  const [paymentOrdersError, setPaymentOrdersError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);
      setRole(u?.uid ? getUserRole(u.uid) : null);
      setDisplayNameDraft(u?.displayName ?? "");
      setPhotoUrlDraft(u?.photoURL ?? "");
    });
    return unsub;
  }, []);

  useEffect(() => {
    const hash = location.hash;
    if (!hash) return;

    const id = hash.replace("#", "");
    if (!id) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [location.hash]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    if (!user?.uid) {
      setUsername(null);
      setUsernameDraft("");
      return undefined;
    }

    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const data = snap.data() || {};
        const nextUsername = data.username || data.usernameLower || null;
        setUsername(nextUsername);
        setUsernameDraft((prev) => (prev ? prev : nextUsername || ""));

        setProActive(Boolean(data.proActive || data.isPro || data.subscriptionActive));
        setVerifiedBadge(Boolean(data.verifiedBadge || data.isVerified));
        setProEndsAt(data.proEndsAt || null);
      },
      (err) => {
        console.error("Failed to load username", err);
        setUsername(null);
        setUsernameDraft("");
        setProActive(false);
        setVerifiedBadge(false);
        setProEndsAt(null);
      },
    );

    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setPaymentOrders([]);
      setPaymentOrdersError(null);
      return;
    }

    let cancelled = false;
    setPaymentOrdersLoading(true);
    setPaymentOrdersError(null);

    getMyPaymentOrders(10)
      .then((items) => {
        if (cancelled) return;
        setPaymentOrders(Array.isArray(items) ? items : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setPaymentOrders([]);
        setPaymentOrdersError(e);
      })
      .finally(() => {
        if (cancelled) return;
        setPaymentOrdersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  async function upgradeToPro() {
    if (!user?.uid || upgradingPro) return;

    try {
      setUpgradingPro(true);
      const { orderId, paymentId, signature } = await openRazorpayCheckout({
        amountRupees: 800,
        purpose: "Pro subscription (₹800)",
        prefill: { email: user?.email || undefined },
        notes: {
          purchase_type: "subscription",
          plan: "pro",
          duration_days: 30,
        },
      });

      const verify = await verifyRazorpayPayment({ orderId, paymentId, signature });
      if (!verify?.ok) throw new Error(verify?.error || "Payment verification failed");

      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await setDoc(
        doc(db, "users", user.uid),
        {
          proActive: true,
          verifiedBadge: true,
          proPlan: "pro",
          proEndsAt: end,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      try {
        const status = await getMySubscriptionStatus();
        setProActive(Boolean(status?.active));
        setProEndsAt(status?.currentPeriodEnd || end);
      } catch {
        setProActive(true);
        setProEndsAt(end);
      }

      toast({ title: "Subscription active", description: "Pro is enabled on your profile." });
    } catch (e) {
      toast({
        title: "Upgrade failed",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpgradingPro(false);
    }
  }

  async function saveUsername() {
    if (!user?.uid) return;

    const normalized = normalizeUsername(usernameDraft);
    setUsernameError(null);
    setUsernameSuccess(null);

    if (!isValidUsername(normalized)) {
      setUsernameError(
        "Username must be 3–20 chars and only use letters, numbers, . and _. It cannot end with . or _. ",
      );
      return;
    }

    setUsernameSaving(true);
    try {
      const q = query(
        collection(db, "users"),
        where("usernameLower", "==", normalized),
        limit(1),
      );
      const snap = await getDocs(q);
      const takenByOther = snap.docs.some((d) => d.id !== user.uid);
      if (takenByOther) {
        setUsernameError("That username is already taken.");
        return;
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          username: normalized,
          usernameLower: normalized,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setUsername(normalized);
      setUsernameDraft(normalized);
      setUsernameSuccess("Username updated.");
    } catch (e) {
      console.error("Failed to update username", e);
      setUsernameError(e?.message ?? "Failed to update username");
    } finally {
      setUsernameSaving(false);
    }
  }

  const effectiveRole = role ?? "client";

  const providers = useMemo(() => {
    const list = user?.providerData ?? [];
    return list.map((p) => p?.providerId).filter(Boolean);
  }, [user]);

  const multiFactorEnabled = useMemo(() => {
    const factors = user?.multiFactor?.enrolledFactors ?? [];
    return factors.length > 0;
  }, [user]);

  const createdAt = useMemo(() => {
    const ts = user?.metadata?.creationTime;
    return ts ? new Date(ts) : null;
  }, [user]);

  const lastLoginAt = useMemo(() => {
    const ts = user?.metadata?.lastSignInTime;
    return ts ? new Date(ts) : null;
  }, [user]);

  async function saveDisplayName() {
    if (!user) return;
    const name = displayNameDraft.trim();
    const photoURL = photoUrlDraft.trim();
    setSavingProfile(true);
    try {
      await updateProfile(user, { displayName: name, photoURL: photoURL || null });
      toast({ title: "Profile updated", description: "Your display name has been saved." });
      // Refresh local state.
      setUser({ ...user, displayName: name, photoURL: photoURL || null });
      window.dispatchEvent(new Event("profile-updated"));
    } catch (err) {
      toast({
        title: "Could not update profile",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadProfilePhoto() {
    if (!user?.uid) return;
    if (!photoFile) return;

    // Basic client-side validation
    if (!photoFile.type?.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please choose an image file.",
        variant: "destructive",
      });
      return;
    }

    // ~3MB limit to keep it snappy
    if (photoFile.size > 3 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image under 3MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingPhoto(true);
    try {
      const safeName = String(photoFile.name || "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
      // Supabase Storage bucket: "avatars"
      // Path inside bucket: {userId}/{filename}
      const path = `${user.uid}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, photoFile, {
          contentType: photoFile.type,
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = publicData?.publicUrl;
      if (!url) throw new Error("Could not get public URL for uploaded photo");

      // Save into Firebase Auth profile
      await updateProfile(user, { photoURL: url });
      setPhotoUrlDraft(url);
      setUser({ ...user, photoURL: url });
      setPhotoFile(null);

      toast({ title: "Photo updated", description: "Your profile photo has been updated." });
      window.dispatchEvent(new Event("profile-updated"));
    } catch (err) {
      toast({
        title: "Photo upload failed",
        description:
          err?.message ??
          "Make sure the Supabase Storage bucket 'avatars' exists and is public (or use signed URLs).",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function resendVerification() {
    if (!user) return;
    setSendingVerify(true);
    try {
      await sendEmailVerification(user);
      toast({
        title: "Verification email sent",
        description: "Check your inbox to verify your email address.",
      });
    } catch (err) {
      toast({
        title: "Could not send verification email",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingVerify(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Account - GigFlow</title>
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-10 space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Account</h1>
            <p className="text-muted-foreground">
              {user?.uid ? (
                <>
                  Signed in as{" "}
                  <span className="font-medium text-foreground">
                    {username ? `@${username}` : "(username not set)"}
                  </span>
                  {verifiedBadge ? <Badge className="ml-2" variant="secondary">Verified</Badge> : null}
                  {proActive ? <Badge className="ml-2" variant="outline">Pro</Badge> : null}
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-foreground">{effectiveRole}</span>
                </>
              ) : (
                "Loading account…"
              )}
            </p>
          </header>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription>Name and sign-in details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <Avatar className="h-14 w-14">
                  <AvatarImage src={photoPreviewUrl || photoUrlDraft || user?.photoURL || ""} alt="Profile photo" />
                    <AvatarFallback>
                      {(user?.email?.slice(0, 1) || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {user?.displayName || "Your profile"}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {username ? `@${username}` : "Username not set"}
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {verifiedBadge ? <Badge variant="secondary">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
                      {proActive ? (
                        <Badge variant="outline">Pro</Badge>
                      ) : (
                        <Button size="sm" onClick={upgradeToPro} disabled={upgradingPro}>
                          {upgradingPro ? "Processing…" : "Upgrade ₹800"}
                        </Button>
                      )}
                      {proEndsAt ? (
                        <span className="text-xs text-muted-foreground">Until {new Date(proEndsAt).toLocaleDateString()}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="photoFile">Profile photo</Label>
                    <Input
                      id="photoFile"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                      disabled={!user || uploadingPhoto}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        onClick={uploadProfilePhoto}
                        disabled={!user || !photoFile || uploadingPhoto}
                      >
                        {uploadingPhoto ? "Uploading…" : "Upload photo"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoUrlDraft("");
                        }}
                        disabled={!user || (!photoUrlDraft && !photoFile) || uploadingPhoto}
                      >
                        Remove photo
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        PNG/JPG/WebP, up to 3MB.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display name</Label>
                    <Input
                      id="displayName"
                      value={displayNameDraft}
                      onChange={(e) => setDisplayNameDraft(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input value={username ? `@${username}` : "Not set"} readOnly />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Phone number</Label>
                    <Input value={user?.phoneNumber ?? "Not set"} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={effectiveRole} readOnly />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={saveDisplayName} disabled={!user || savingProfile}>
                    {savingProfile ? "Saving…" : "Save profile"}
                  </Button>
                  {!user?.emailVerified ? (
                    <Button variant="outline" onClick={resendVerification} disabled={!user || sendingVerify}>
                      {sendingVerify ? "Sending…" : "Resend verification email"}
                    </Button>
                  ) : (
                    <Badge variant="secondary">Email verified</Badge>
                  )}
                </div>

                <Separator />

                <div id="username" className="space-y-3 scroll-mt-24">
                  <div>
                    <div className="font-medium">Username</div>
                    <div className="text-sm text-muted-foreground">
                      This is used for search and messaging.
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="usernameInput">Username</Label>
                      <Input
                        id="usernameInput"
                        value={usernameDraft}
                        onChange={(e) => setUsernameDraft(e.target.value)}
                        disabled={!user || usernameSaving}
                        placeholder="e.g. akash_01"
                      />
                      {username ? (
                        <div className="text-xs text-muted-foreground">Current: @{username}</div>
                      ) : null}
                      {usernameError ? (
                        <div className="text-xs text-destructive">{String(usernameError)}</div>
                      ) : null}
                      {usernameSuccess ? (
                        <div className="text-xs text-emerald-600">{String(usernameSuccess)}</div>
                      ) : null}
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={saveUsername}
                        disabled={!user || usernameSaving}
                        className="w-full"
                      >
                        {usernameSaving ? "Saving…" : "Save username"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Security</CardTitle>
                <CardDescription>Verification and 2FA status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  {user?.emailVerified ? (
                    <Badge variant="secondary">Verified</Badge>
                  ) : (
                    <Badge variant="outline">Not verified</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Two-factor authentication</span>
                  {multiFactorEnabled ? (
                    <Badge variant="secondary">Enabled</Badge>
                  ) : (
                    <Badge variant="outline">Not enabled</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Username</span>
                  <div className="flex items-center gap-2">
                    {username ? (
                      <Badge variant="secondary">@{username}</Badge>
                    ) : (
                      <Badge variant="outline">Not set</Badge>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        document
                          .getElementById("username")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                      disabled={!user}
                    >
                      Set username
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="text-xs text-muted-foreground">
                  2FA enrollment isn’t implemented in this demo UI.
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Purchase history</CardTitle>
              <CardDescription>Your recent payments (stored in Supabase)</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentOrdersError ? (
                <div className="text-sm text-destructive">
                  {String(paymentOrdersError?.message || paymentOrdersError)}
                </div>
              ) : null}

              {paymentOrdersLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : paymentOrders.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentOrders.map((o) => {
                      const notes = o?.notes || {};
                      const purpose = String(notes?.purpose || notes?.invoice_type || notes?.purchase_type || "Payment");
                      const amount = Number(o?.amount || 0) / 100;
                      const dateIso = o?.paid_at || o?.created_at;
                      const dateLabel = dateIso ? new Date(dateIso).toLocaleString() : "";
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="max-w-[520px] truncate">{purpose}</TableCell>
                          <TableCell>
                            <Badge variant={o.status === "paid" ? "secondary" : "outline"}>
                              {String(o.status || "")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">₹{amount.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{dateLabel}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-sm text-muted-foreground">No payments yet.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account details</CardTitle>
              <CardDescription>Provider, timestamps, and identifiers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">User ID</TableCell>
                    <TableCell className="font-mono text-sm break-all">{user?.uid ?? ""}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Providers</TableCell>
                    <TableCell>{providers.length ? providers.join(", ") : "email/password"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Created</TableCell>
                    <TableCell>
                      {createdAt
                        ? createdAt.toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Last sign-in</TableCell>
                    <TableCell>
                      {lastLoginAt
                        ? lastLoginAt.toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    </>
  );
}
