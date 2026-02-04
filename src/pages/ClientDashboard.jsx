import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { auth, db } from "@/firebase";
import { getUserRole } from "@/auth/role";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Briefcase,
  CreditCard,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

import MessagesPage from "@/pages/MessagesPage";
import { isValidUsername, normalizeUsername } from "@/lib/userProfile";
import { openRazorpayCheckout, verifyRazorpayPayment } from "@/lib/payments";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(amount) {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInr(amountRupees) {
  const value = typeof amountRupees === "number" && Number.isFinite(amountRupees) ? amountRupees : 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusVariant(status) {
  const s = String(status || "").toLowerCase();
  if (["active", "in progress", "open", "paid", "hired"].includes(s)) return "default";
  if (["pending", "submitted"].includes(s)) return "secondary";
  if (["rejected", "overdue"].includes(s)) return "destructive";
  return "outline";
}

function projectStatusBadge(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "in progress" || s === "active") {
    return { label: "In Progress", className: "border-blue-200 bg-blue-500/10 text-blue-700" };
  }
  if (s === "submitted" || s === "pending") {
    return { label: "Submitted", className: "border-amber-200 bg-amber-500/10 text-amber-800" };
  }
  if (s === "completed" || s === "done" || s === "paid") {
    return { label: "Completed", className: "border-emerald-200 bg-emerald-500/10 text-emerald-700" };
  }
  return { label: String(status || "Unknown"), className: "" };
}

export default function ClientDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [userEmail, setUserEmail] = useState(null);
  const [userUid, setUserUid] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [username, setUsername] = useState(null);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState(null);
  const [usernameSuccess, setUsernameSuccess] = useState(null);

  const [activeTab, setActiveTab] = useState("projects");

  const [postJobOpen, setPostJobOpen] = useState(false);
  const [jobDraft, setJobDraft] = useState(() => ({
    title: "",
    category: "Programming & Tech",
    budget: 12000,
    details: "",
  }));

  const [projects, setProjects] = useState(() => [
    {
      id: "prj-1",
      title: "Landing page redesign",
      freelancer: "Aanya",
      status: "In Progress",
      budget: 900,
      dueISO: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "prj-2",
      title: "SEO blog content (10 posts)",
      freelancer: "Rohan",
      status: "Submitted",
      budget: 450,
      dueISO: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "prj-3",
      title: "Mobile app bugfix sprint",
      freelancer: "Meera",
      status: "Completed",
      budget: 700,
      dueISO: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const [proposals, setProposals] = useState(() => [
    {
      id: "prop-1",
      jobTitle: "React dashboard UI",
      freelancer: "Ishaan",
      rate: 35,
      cover: "Can deliver a clean shadcn-based dashboard with responsive layout and reusable sections.",
      status: "Open",
      submittedISO: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "prop-2",
      jobTitle: "Logo refresh",
      freelancer: "Diya",
      rate: 25,
      cover: "I can provide 3 concepts + variations and brand guidelines.",
      status: "Open",
      submittedISO: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const [unreadChatsCount, setUnreadChatsCount] = useState(0);

  const [invoices, setInvoices] = useState(() => [
    {
      id: "inv-101",
      type: "Project milestone",
      amount: 300,
      status: "Paid",
      dateISO: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "inv-102",
      type: "Platform fee",
      amount: 42,
      status: "Paid",
      dateISO: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "inv-103",
      type: "Project deposit",
      amount: 450,
      status: "Pending",
      dateISO: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const [payingInvoiceId, setPayingInvoiceId] = useState(null);

  const [notifications, setNotifications] = useState(() => [
    {
      id: "ntf-1",
      title: "New proposal received",
      detail: "Ishaan applied for React dashboard UI.",
      unread: true,
      timeISO: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: "ntf-2",
      title: "Milestone submitted",
      detail: "Rohan submitted draft for 2 blog posts.",
      unread: true,
      timeISO: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "ntf-3",
      title: "Payment processed",
      detail: "Invoice inv-101 has been paid.",
      unread: false,
      timeISO: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  const [account, setAccount] = useState(() => ({
    companyName: "",
    contactName: "",
    billingEmail: "",
    twoFactorEnabled: false,
  }));

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserEmail(u?.email ?? null);
      setUserUid(u?.uid ?? null);
      setUserRole(u?.uid ? getUserRole(u.uid) : null);

      setAccount((prev) => ({
        ...prev,
        billingEmail: prev.billingEmail || (u?.email ?? ""),
        contactName: prev.contactName || (u?.displayName ?? ""),
      }));
    });
    return unsub;
  }, []);

  async function payInvoice(invoice) {
    if (!invoice || payingInvoiceId) return;

    try {
      setPayingInvoiceId(invoice.id);

      const amountRupees = Number(invoice.amount);
      if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
        throw new Error("Invalid invoice amount");
      }

      const { orderId, paymentId, signature } = await openRazorpayCheckout({
        amountRupees,
        purpose: `Invoice ${invoice.id} (${invoice.type})`,
        prefill: { email: userEmail || undefined },
        notes: {
          invoice_id: invoice.id,
          invoice_type: invoice.type,
        },
      });

      const verify = await verifyRazorpayPayment({
        orderId,
        paymentId,
        signature,
      });

      if (!verify?.ok) {
        throw new Error(verify?.error || "Payment verification failed");
      }

      setInvoices((prev) =>
        prev.map((x) => (x.id === invoice.id ? { ...x, status: "Paid" } : x)),
      );

      toast({
        title: "Payment successful",
        description: `Invoice ${invoice.id} marked as paid.`,
      });
    } catch (e) {
      toast({
        title: "Payment failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPayingInvoiceId(null);
    }
  }

  useEffect(() => {
    if (!userUid) {
      setUsername(null);
      setUsernameDraft("");
      return undefined;
    }

    const unsub = onSnapshot(
      doc(db, "users", userUid),
      (snap) => {
        const data = snap.data() || {};
        const nextUsername = data.username || data.usernameLower || null;
        setUsername(nextUsername);
        setUsernameDraft((prev) => (prev ? prev : nextUsername || ""));
      },
      (err) => {
        console.error("Failed to load user profile", err);
        setUsername(null);
        setUsernameDraft("");
      },
    );

    return unsub;
  }, [userUid]);

  async function saveUsername() {
    if (!userUid) return;

    const normalized = normalizeUsername(usernameDraft);
    setUsernameError(null);
    setUsernameSuccess(null);

    if (!isValidUsername(normalized)) {
      setUsernameError("Username must be 3–20 chars and only use letters, numbers, . and _. It cannot end with . or _. ");
      return;
    }

    setUsernameSaving(true);
    try {
      // Enforce uniqueness.
      const q = query(
        collection(db, "users"),
        where("usernameLower", "==", normalized),
        limit(1),
      );
      const snap = await getDocs(q);
      const takenByOther = snap.docs.some((d) => d.id !== userUid);
      if (takenByOther) {
        setUsernameError("That username is already taken.");
        return;
      }

      await setDoc(
        doc(db, "users", userUid),
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

  useEffect(() => {
    // Real-time unread badge for the Overview tab.
    // We sum chats.unreadCount[userUid] across all chats.
    if (!userUid) {
      setUnreadChatsCount(0);
      return undefined;
    }

    const chatsQ = query(
      collection(db, "chats"),
      where("participants", "array-contains", userUid),
      orderBy("lastUpdated", "desc"),
    );

    const unsub = onSnapshot(chatsQ, (snap) => {
      let total = 0;
      snap.docs.forEach((d) => {
        const data = d.data() || {};
        const unread = Number(data.unreadCount?.[userUid] || 0);
        total += Number.isFinite(unread) ? unread : 0;
      });
      setUnreadChatsCount(total);
    });

    return unsub;
  }, [userUid]);

  const overview = useMemo(() => {
    const activeProjects = projects.filter((p) => ["in progress", "active", "submitted"].includes(String(p.status).toLowerCase())).length;
    const openProposals = proposals.filter((p) => String(p.status).toLowerCase() === "open").length;
    const unreadMessages = unreadChatsCount;
    const totalSpend = projects.reduce((sum, p) => sum + (p.status === "Completed" ? p.budget : 0), 0) + invoices
      .filter((i) => i.status === "Paid")
      .reduce((sum, i) => sum + i.amount, 0);

    return {
      activeProjects,
      openProposals,
      unreadMessages,
      totalSpend,
    };
  }, [projects, proposals, unreadChatsCount, invoices]);

  function hireProposal(proposalId) {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: "Hired" } : p)),
    );
  }

  function rejectProposal(proposalId) {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: "Rejected" } : p)),
    );
  }

  function markNotificationRead(notificationId) {
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, unread: false } : n)));
  }

  function markAllNotificationsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }

  function postJob() {
    setPostJobOpen(true);
  }

  function browseFreelancers() {
    navigate("/gigs");
  }

  function submitJobDraft() {
    const title = String(jobDraft.title || "").trim();
    const category = String(jobDraft.category || "").trim();
    const budget = Number(jobDraft.budget);
    if (!title || !category || !Number.isFinite(budget) || budget <= 0) {
      toast({
        title: "Missing job details",
        description: "Please add a title, category, and budget.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Job posted",
      description: "Your job is live. You’ll start receiving proposals shortly.",
    });

    setPostJobOpen(false);
    setJobDraft({ title: "", category: "Programming & Tech", budget: 12000, details: "" });
    setActiveTab("proposals");
  }

  const unreadNotificationsCount = useMemo(() => notifications.filter((n) => n.unread).length, [notifications]);
  const effectiveRole = userRole ?? "client";

  return (
    <>
      <Helmet>
        <title>Client Dashboard - GigFlow</title>
      </Helmet>

      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-6 sm:py-10 space-y-8">
          <header className="space-y-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold text-foreground">Client Dashboard</h1>
                <p className="text-muted-foreground">
                  {userEmail ? (
                    <>
                      Signed in as <span className="font-medium text-foreground">{userEmail}</span>
                      {username ? (
                        <span className="ml-2 text-xs text-muted-foreground">@{username}</span>
                      ) : null}
                    </>
                  ) : (
                    "Loading account…"
                  )}
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Button variant="hero" size="lg" className="w-full sm:w-auto" onClick={postJob}>
                  <Plus className="h-4 w-4" />
                  Post a Job
                </Button>
                <Button variant="hero-outline" size="lg" className="w-full sm:w-auto" onClick={browseFreelancers}>
                  <Search className="h-4 w-4" />
                  Browse Freelancers
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Green, secure marketplace experience
              </span>
            </div>
          </header>

          <Separator className="my-2" />

          {/* Always-visible SaaS overview */}
          <section className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Active Projects",
                  value: overview.activeProjects,
                  icon: Briefcase,
                },
                {
                  label: "Open Proposals",
                  value: overview.openProposals,
                  icon: Users,
                },
                {
                  label: "Unread Messages",
                  value: overview.unreadMessages,
                  icon: MessageSquare,
                },
                {
                  label: "Total Spend",
                  value: formatInr(overview.totalSpend),
                  icon: CreditCard,
                },
              ].map((item) => (
                <Card
                  key={item.label}
                  className="rounded-2xl shadow-card hover:shadow-card-hover transition-all border-border/70"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardDescription>{item.label}</CardDescription>
                        <CardTitle className="text-2xl mt-1">
                          {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                        </CardTitle>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center">
                        <item.icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 rounded-2xl shadow-card border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Projects Snapshot</CardTitle>
                  <CardDescription>Recent projects and their current status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="-mx-4 overflow-x-auto px-4">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Freelancer Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.slice(0, 5).map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/40">
                          <TableCell className="min-w-56 font-medium">
                            <div className="truncate">{p.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground sm:hidden">{p.freelancer}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{p.freelancer}</TableCell>
                          <TableCell>
                            {(() => {
                              const b = projectStatusBadge(p.status);
                              return (
                                <Badge variant="outline" className={b.className}>
                                  {b.label}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">{formatInr(p.budget)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-card border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                  <CardDescription>Jump to common workflows</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant="hero" onClick={postJob}>
                    <Plus className="h-4 w-4" />
                    Post a Job
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab("proposals")}>
                    <Users className="h-4 w-4" />
                    Review Proposals
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab("payments")}>
                    <CreditCard className="h-4 w-4" />
                    View Invoices
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab("messages")}>
                    <MessageSquare className="h-4 w-4" />
                    Open Messages
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator className="my-2" />

          {/* Detailed workflows */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="-mx-4 max-w-full overflow-x-auto px-4 no-scrollbar pt-1">
              <TabsList className="min-w-max justify-start gap-1 whitespace-nowrap">
                <TabsTrigger className="shrink-0 px-2 sm:px-3" value="projects">
                  <span className="hidden sm:inline">Projects & Orders</span>
                  <span className="sm:hidden">Projects</span>
                </TabsTrigger>
                <TabsTrigger className="shrink-0 px-2 sm:px-3" value="proposals">Proposals</TabsTrigger>
                <TabsTrigger className="shrink-0 px-2 sm:px-3" value="messages">Messages</TabsTrigger>
                <TabsTrigger className="shrink-0 px-2 sm:px-3" value="payments">Payments</TabsTrigger>
                <TabsTrigger className="shrink-0 px-2 sm:px-3" value="notifications">
                  Notifications
                  {unreadNotificationsCount ? (
                    <span className="ml-2 inline-flex min-w-5 justify-center rounded-full bg-muted px-1.5 text-xs text-foreground">
                      {unreadNotificationsCount}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger className="shrink-0 px-2 sm:px-3" value="settings">
                  <span className="hidden sm:inline">Account & Security</span>
                  <span className="sm:hidden">Account</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="projects" className="mt-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Projects & orders</CardTitle>
                  <CardDescription>Status, budgets, and due dates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="-mx-4 overflow-x-auto px-4">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead className="hidden sm:table-cell">Freelancer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Due</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="min-w-60 font-medium">
                            <div className="truncate">{p.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground sm:hidden">
                              {p.freelancer}
                              <span className="mx-1">·</span>
                              due {new Date(p.dueISO).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{p.freelancer}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {new Date(p.dueISO).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(p.budget)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="proposals" className="mt-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Proposals inbox</CardTitle>
                  <CardDescription>Hire or reject applicants</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {proposals.length ? (
                    <div className="grid gap-4">
                      {proposals.map((p) => (
                        <div key={p.id} className="rounded-lg border border-border p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{p.jobTitle}</div>
                              <div className="text-sm text-muted-foreground">
                                {p.freelancer} · {formatCurrency(p.rate)}/hr · submitted {new Date(p.submittedISO).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:flex-wrap">
                              <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                              <Button
                                size="sm"
                                className="w-full sm:w-auto"
                                disabled={String(p.status).toLowerCase() !== "open"}
                                onClick={() => hireProposal(p.id)}
                              >
                                Hire
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto"
                                disabled={String(p.status).toLowerCase() !== "open"}
                                onClick={() => rejectProposal(p.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-foreground">{p.cover}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No proposals yet.</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages" className="mt-6 space-y-4">
              <MessagesPage currentUid={userUid} />
            </TabsContent>

            <TabsContent value="payments" className="mt-6 space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Payments & invoices</CardTitle>
                    <CardDescription>Recent billing activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="-mx-4 overflow-x-auto px-4">
                      <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead className="hidden sm:table-cell">Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((i) => (
                          <TableRow key={i.id}>
                            <TableCell className="min-w-40 font-medium">
                              <div>{i.id}</div>
                              <div className="mt-1 text-xs text-muted-foreground sm:hidden">
                                {i.type}
                                <span className="mx-1">·</span>
                                {new Date(i.dateISO).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">{i.type}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(i.status)}>{i.status}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {new Date(i.dateISO).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="text-right">{formatInr(i.amount)}</TableCell>
                            <TableCell className="text-right">
                              {String(i.status).toLowerCase() === "pending" ? (
                                <Button
                                  size="sm"
                                  onClick={() => payInvoice(i)}
                                  disabled={Boolean(payingInvoiceId) && payingInvoiceId !== i.id}
                                >
                                  {payingInvoiceId === i.id ? "Processing…" : "Pay"}
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => setInvoices((prev) => prev)}>
                                  Download
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Billing summary</CardTitle>
                    <CardDescription>Placeholder totals</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Paid invoices</span>
                      <span className="font-medium">
                        {formatInr(invoices.filter((x) => x.status === "Paid").reduce((s, x) => s + x.amount, 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Pending invoices</span>
                      <span className="font-medium">
                        {formatInr(invoices.filter((x) => x.status !== "Paid").reduce((s, x) => s + x.amount, 0))}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Payment method</span>
                      <span className="font-medium">Visa •••• 4242</span>
                    </div>
                    <Button className="w-full" variant="outline" onClick={() => setActiveTab("settings")}>
                      Update billing info
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-6 space-y-4">
              <Card>
                <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                  <div>
                    <CardTitle className="text-base">Notifications</CardTitle>
                    <CardDescription>Updates about proposals, projects, and payments</CardDescription>
                  </div>
                  <Button className="w-full sm:w-auto" variant="outline" onClick={markAllNotificationsRead} disabled={!unreadNotificationsCount}>
                    Mark all read
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {notifications.map((n) => (
                    <div key={n.id} className="rounded-lg border border-border p-4 flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium">{n.title}</div>
                          {n.unread ? <Badge>New</Badge> : <Badge variant="secondary">Read</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">{n.detail}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(n.timeISO).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                      {n.unread ? (
                        <Button size="sm" variant="outline" onClick={() => markNotificationRead(n.id)}>
                          Mark read
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-6 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Account</CardTitle>
                    <CardDescription>Company and contact details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          id="username"
                          value={usernameDraft}
                          onChange={(e) => setUsernameDraft(e.target.value)}
                          placeholder="e.g. akash.dev"
                        />
                        <Button
                          type="button"
                          className="w-full sm:w-auto"
                          variant="outline"
                          disabled={!userUid || usernameSaving}
                          onClick={saveUsername}
                        >
                          {usernameSaving ? "Saving…" : "Save"}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">Others can search you by this in Messages.</div>
                      {usernameError ? (
                        <div className="text-xs text-destructive">{usernameError}</div>
                      ) : null}
                      {usernameSuccess ? (
                        <div className="text-xs text-muted-foreground">{usernameSuccess}</div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={account.companyName}
                        onChange={(e) => setAccount((p) => ({ ...p, companyName: e.target.value }))}
                        placeholder="e.g. Acme Inc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact">Contact name</Label>
                      <Input
                        id="contact"
                        value={account.contactName}
                        onChange={(e) => setAccount((p) => ({ ...p, contactName: e.target.value }))}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing">Billing email</Label>
                      <Input
                        id="billing"
                        value={account.billingEmail}
                        onChange={(e) => setAccount((p) => ({ ...p, billingEmail: e.target.value }))}
                        placeholder="billing@company.com"
                      />
                    </div>
                    <Button variant="outline" onClick={() => setAccount((p) => ({ ...p }))}>
                      Save changes
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Security</CardTitle>
                    <CardDescription>Password and multi-factor settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium">Two-factor authentication</div>
                        <div className="text-sm text-muted-foreground">Protect your account with an extra step</div>
                      </div>
                      <Switch
                        checked={account.twoFactorEnabled}
                        onCheckedChange={(checked) => setAccount((p) => ({ ...p, twoFactorEnabled: checked }))}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current password</Label>
                      <Input id="current-password" type="password" placeholder="••••••••" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New password</Label>
                      <Input id="new-password" type="password" placeholder="••••••••" />
                    </div>
                    <Button variant="outline">Update password</Button>

                    {userUid ? (
                      <p className="text-xs text-muted-foreground">
                        Role switching is available from the profile menu in the navbar.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </main>
        <Footer />
      </div>

      <Dialog open={postJobOpen} onOpenChange={setPostJobOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Post a Job</DialogTitle>
            <DialogDescription>
              Create a job post and start receiving proposals from verified freelancers.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="job-title">Job title</Label>
              <Input
                id="job-title"
                value={jobDraft.title}
                onChange={(e) => setJobDraft((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Build a responsive client dashboard UI"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-category">Category</Label>
              <select
                id="job-category"
                value={jobDraft.category}
                onChange={(e) => setJobDraft((p) => ({ ...p, category: e.target.value }))}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {[
                  "Graphics & Design",
                  "Digital Marketing",
                  "Writing & Translation",
                  "Video & Animation",
                  "Programming & Tech",
                  "Business",
                ].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-budget">Budget (INR)</Label>
              <Input
                id="job-budget"
                type="number"
                min={1}
                value={jobDraft.budget}
                onChange={(e) => setJobDraft((p) => ({ ...p, budget: Number(e.target.value) }))}
                placeholder="12000"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="job-details">Details</Label>
              <Textarea
                id="job-details"
                value={jobDraft.details}
                onChange={(e) => setJobDraft((p) => ({ ...p, details: e.target.value }))}
                placeholder="Scope, references, timelines, and success criteria…"
                className="min-h-[120px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPostJobOpen(false)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={submitJobDraft}>
              Post Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
