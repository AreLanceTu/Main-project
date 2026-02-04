import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { auth, db } from "@/firebase";
import { getUserRole, setUserRole } from "@/auth/role";
import { useToast } from "@/hooks/use-toast";

type JobDraft = {
  title: string;
  category: string;
  budget: string;
  description: string;
};

const CATEGORIES = [
  "Graphics & Design",
  "Digital Marketing",
  "Writing & Translation",
  "Video & Animation",
  "Programming & Tech",
  "Business",
];

export default function JobPost() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [uid, setUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  const [role, setRole] = useState<string | null>(() => (auth.currentUser?.uid ? getUserRole(auth.currentUser.uid) : null));

  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<JobDraft>({
    title: "",
    category: CATEGORIES[0],
    budget: "",
    description: "",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setRole(u?.uid ? getUserRole(u.uid) : null);
    });
    return unsub;
  }, []);

  const isFreelancerRole = useMemo(() => role === "freelancer", [role]);

  const canSubmit = useMemo(() => {
    const titleOk = draft.title.trim().length >= 5;
    const descOk = draft.description.trim().length >= 20;
    const budgetNum = Number(draft.budget);
    const budgetOk = Number.isFinite(budgetNum) && budgetNum > 0;
    return titleOk && descOk && budgetOk && !saving && Boolean(uid);
  }, [draft.budget, draft.description, draft.title, saving, uid]);

  async function submit() {
    if (!uid) {
      toast({ title: "Not signed in", description: "Please log in to post a job.", variant: "destructive" });
      return;
    }

    if (!canSubmit) return;

    try {
      setSaving(true);

      const payload = {
        title: draft.title.trim(),
        category: draft.category,
        budget: Number(draft.budget),
        description: draft.description.trim(),
        createdBy: uid,
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "job_posts"), payload);

      toast({ title: "Job posted", description: "Your job post is live." });
      setDraft({ title: "", category: CATEGORIES[0], budget: "", description: "" });
      navigate("/dashboard");
    } catch (e: any) {
      toast({
        title: "Could not post job",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Post a Job - GigFlow</title>
        <meta name="description" content="Post a job to hire freelancers" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />

        <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-10">
          <div className="max-w-2xl mx-auto space-y-4">
            {isFreelancerRole ? (
              <Card>
                <CardHeader>
                  <CardTitle>Switch to client to post jobs</CardTitle>
                  <CardDescription>
                    You’re currently in freelancer mode. Switch to client to create job posts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      if (!uid) return;
                      setUserRole(uid, "client");
                      setRole("client");
                      navigate("/dashboard");
                    }}
                  >
                    Switch to Client
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                    Go back
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Post a job</CardTitle>
                <CardDescription>Describe what you need and set a budget.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Title</div>
                    <Input
                      value={draft.title}
                      onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Build a landing page"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Category</div>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={draft.category}
                      onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Budget (₹)</div>
                  <Input
                    inputMode="numeric"
                    value={draft.budget}
                    onChange={(e) => setDraft((p) => ({ ...p, budget: e.target.value }))}
                    placeholder="e.g. 1500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Description</div>
                  <Textarea
                    value={draft.description}
                    onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Share requirements, references, deadline, etc."
                    rows={6}
                  />
                  <div className="text-xs text-muted-foreground">
                    Tip: Include scope, timeline, deliverables, and examples.
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button type="button" onClick={submit} disabled={!canSubmit || isFreelancerRole}>
                    {saving ? "Posting…" : "Post job"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
