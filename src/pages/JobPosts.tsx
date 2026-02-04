import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { auth, db } from "@/firebase";
import { getUserRole } from "@/auth/role";

type JobPostDoc = {
  id: string;
  title: string;
  category: string;
  budget: number;
  description: string;
  status: string;
  createdBy: string;
  createdAt?: any;
};

function safeDateString(ts: any): string {
  try {
    const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : ts ? new Date(ts) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

async function seedDummyJobPosts({
  uid,
  seededKey,
  setSeeded,
  setSeeding,
  alreadySeeding,
}: {
  uid: string;
  seededKey: string | null;
  setSeeded: Dispatch<SetStateAction<boolean>>;
  setSeeding: Dispatch<SetStateAction<boolean>>;
  alreadySeeding: boolean;
}) {
  if (!uid) return;
  if (!import.meta.env.DEV) return;
  if (alreadySeeding) return;

  setSeeding(true);
  try {
    const samples = [
      {
        title: "Need a modern landing page for my startup",
        category: "Programming & Tech",
        budget: 3500,
        description:
          "Looking for a responsive landing page (React/Vite preferred). Include hero, pricing, testimonials, and contact form. Share a couple of similar examples and your ETA.",
      },
      {
        title: "Logo + brand kit for cafe",
        category: "Graphics & Design",
        budget: 2000,
        description:
          "We need a fresh logo + color palette + 2–3 social media templates. Please include previous branding work and a clear deliverables list.",
      },
      {
        title: "Product description writing (10 items)",
        category: "Writing & Translation",
        budget: 1500,
        description:
          "Need SEO-friendly product descriptions for 10 items. Provide 1 sample description and your turnaround time.",
      },
      {
        title: "Edit 6 short Reels for Instagram",
        category: "Video & Animation",
        budget: 2500,
        description:
          "I have raw clips (phone footage). Need fast-paced edits with captions, basic color correction, and trending music suggestions. Deliver 6 reels (20–35s each).",
      },
      {
        title: "Setup Google Ads campaign for local service business",
        category: "Digital Marketing",
        budget: 4000,
        description:
          "Create a basic search campaign + keyword research + ad copies + conversion tracking guidance. Share what access you need and expected setup timeline.",
      },
      {
        title: "Build a simple portfolio website (3 pages)",
        category: "Programming & Tech",
        budget: 3000,
        description:
          "Need a clean portfolio site: Home, Projects, Contact. Mobile-first, fast loading, and deployed. If you can, include basic SEO + analytics.",
      },
    ];

    for (const s of samples) {
      await addDoc(collection(db, "job_posts"), {
        ...s,
        createdBy: uid,
        status: "open",
        dummy: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (seededKey) {
      try {
        window.localStorage.setItem(seededKey, "1");
      } catch {
        // ignore
      }
    }
    setSeeded(true);
  } catch (e) {
    console.error("Failed to seed dummy job posts", e);
  } finally {
    setSeeding(false);
  }
}

export default function JobPosts() {
  const [uid, setUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  const [role, setRole] = useState<string | null>(() => (auth.currentUser?.uid ? getUserRole(auth.currentUser.uid) : null));

  const [tab, setTab] = useState<string>(() => (role === "freelancer" ? "all" : "mine"));

  const [allJobs, setAllJobs] = useState<JobPostDoc[]>([]);
  const [myJobs, setMyJobs] = useState<JobPostDoc[]>([]);

  const [allLoaded, setAllLoaded] = useState(false);

  const [allError, setAllError] = useState<string | null>(null);
  const [mineError, setMineError] = useState<string | null>(null);

  const [seeding, setSeeding] = useState(false);

  const seededKey = useMemo(() => (uid ? `gigflow:seededJobPosts:${uid}` : null), [uid]);
  const [seeded, setSeeded] = useState<boolean>(() => {
    if (!seededKey) return false;
    try {
      return window.localStorage.getItem(seededKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!seededKey) {
      setSeeded(false);
      return;
    }
    try {
      setSeeded(window.localStorage.getItem(seededKey) === "1");
    } catch {
      setSeeded(false);
    }
  }, [seededKey]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      const nextRole = u?.uid ? getUserRole(u.uid) : null;
      setRole(nextRole);
      setTab((prev) => {
        // If tab hasn't been explicitly changed, choose a sensible default.
        if (prev === "all" || prev === "mine") return prev;
        return nextRole === "freelancer" ? "all" : "mine";
      });
    });
    return unsub;
  }, []);

  // Keep default tab aligned when role loads initially.
  useEffect(() => {
    setTab((prev) => {
      if (prev === "all" || prev === "mine") return prev;
      return role === "freelancer" ? "all" : "mine";
    });
  }, [role]);

  useEffect(() => {
    let unsubAll: Unsubscribe | null = null;

    try {
      const qAll = query(collection(db, "job_posts"), orderBy("createdAt", "desc"), limit(50));
      unsubAll = onSnapshot(
        qAll,
        (snap) => {
          setAllError(null);
          setAllLoaded(true);
          const rows: JobPostDoc[] = snap.docs.map((d) => {
            const data: any = d.data() || {};
            return {
              id: d.id,
              title: String(data.title || ""),
              category: String(data.category || ""),
              budget: Number(data.budget || 0),
              description: String(data.description || ""),
              status: String(data.status || "open"),
              createdBy: String(data.createdBy || ""),
              createdAt: data.createdAt,
            };
          });
          setAllJobs(rows);
        },
        (err) => {
          console.error("Failed to load job posts", err);
          setAllJobs([]);
          setAllLoaded(true);
          setAllError(err?.message || "Failed to load job posts");
        },
      );
    } catch (e: any) {
      console.error("Failed to subscribe job posts", e);
      setAllJobs([]);
      setAllLoaded(true);
      setAllError(e?.message || "Failed to load job posts");
    }

    return () => {
      unsubAll?.();
    };
  }, []);

  useEffect(() => {
    // Dev-only convenience: if the collection is empty, seed a few dummy posts.
    // Keeps UX non-empty without adding production-only UI.
    if (!import.meta.env.DEV) return;
    if (!uid) return;
    if (seeded) return;
    if (!allLoaded) return;
    if (allError) return;
    if (allJobs.length !== 0) return;

    void seedDummyJobPosts({ uid, seededKey, setSeeded, setSeeding, alreadySeeding: seeding });
  }, [allError, allJobs.length, allLoaded, seeded, seededKey, seeding, uid]);

  const onSeedDummyPosts = async () => {
    if (!import.meta.env.DEV) return;
    if (!uid) return;
    await seedDummyJobPosts({ uid, seededKey, setSeeded, setSeeding, alreadySeeding: seeding });
  };

  useEffect(() => {
    if (!uid) {
      setMyJobs([]);
      setMineError(null);
      return;
    }

    let unsubMine: Unsubscribe | null = null;

    const normalizeDoc = (d: any): JobPostDoc => {
      const data: any = d.data() || {};
      return {
        id: d.id,
        title: String(data.title || ""),
        category: String(data.category || ""),
        budget: Number(data.budget || 0),
        description: String(data.description || ""),
        status: String(data.status || "open"),
        createdBy: String(data.createdBy || ""),
        createdAt: data.createdAt,
      };
    };

    const sortByCreatedAtDesc = (rows: JobPostDoc[]) => {
      return [...rows].sort((a, b) => {
        const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return bMs - aMs;
      });
    };

    const fallbackSubscribeWithoutOrderBy = () => {
      const qMineFallback = query(collection(db, "job_posts"), where("createdBy", "==", uid), limit(50));
      return onSnapshot(
        qMineFallback,
        (snap) => {
          setMineError(null);
          const rows = snap.docs.map(normalizeDoc);
          setMyJobs(sortByCreatedAtDesc(rows));
        },
        (err) => {
          console.error("Failed to load my job posts (fallback)", err);
          setMyJobs([]);
          setMineError(err?.message || "Failed to load my job posts");
        },
      );
    };

    try {
      const qMine = query(
        collection(db, "job_posts"),
        where("createdBy", "==", uid),
        orderBy("createdAt", "desc"),
        limit(50),
      );

      unsubMine = onSnapshot(
        qMine,
        (snap) => {
          setMineError(null);
          const rows = snap.docs.map(normalizeDoc);
          setMyJobs(rows);
        },
        (err) => {
          console.error("Failed to load my job posts", err);
          const msg = String(err?.message || "");
          const code = String(err?.code || "");

          // Common case: Firestore requires a composite index for where(createdBy)+orderBy(createdAt).
          // Instead of forcing an index, fall back to a where-only query and sort client-side.
          const looksLikeIndexIssue = code === "failed-precondition" || msg.toLowerCase().includes("index");
          if (looksLikeIndexIssue) {
            try {
              unsubMine?.();
            } catch {
              // ignore
            }
            unsubMine = fallbackSubscribeWithoutOrderBy();
            return;
          }

          setMyJobs([]);
          setMineError(err?.message || "Failed to load my job posts");
        },
      );
    } catch (e: any) {
      console.error("Failed to subscribe my job posts", e);
      setMyJobs([]);
      setMineError(e?.message || "Failed to load your job posts");
    }

    return () => {
      unsubMine?.();
    };
  }, [uid]);

  const headerSubtitle = useMemo(() => {
    if (role === "freelancer") return "Browse jobs posted by clients.";
    return "Manage your job posts and browse open work.";
  }, [role]);

  const list = tab === "mine" ? myJobs : allJobs;
  const error = tab === "mine" ? mineError : allError;

  return (
    <>
      <Helmet>
        <title>Job Posts - GigFlow</title>
        <meta name="description" content="Browse and manage job posts" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />

        <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-10">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-2xl font-bold">Job posts</div>
                <div className="text-sm text-muted-foreground">{headerSubtitle}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {import.meta.env.DEV ? (
                  <Button variant="outline" disabled={!uid || seeding} onClick={onSeedDummyPosts}>
                    {seeding ? "Seeding…" : "Add dummy posts"}
                  </Button>
                ) : null}
                <Button asChild>
                  <Link to="/job-post">Post a job</Link>
                </Button>
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="all">All jobs</TabsTrigger>
                <TabsTrigger value="mine" disabled={!uid}>
                  My jobs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <JobList jobs={allJobs} error={allError} emptyLabel="No job posts yet." />
              </TabsContent>

              <TabsContent value="mine" className="mt-4">
                <JobList jobs={myJobs} error={mineError} emptyLabel={uid ? "You haven’t posted any jobs yet." : "Sign in to see your jobs."} />
              </TabsContent>
            </Tabs>

            {error ? (
              <div className="text-sm text-destructive">
                {error}
                {String(error).toLowerCase().includes("index") ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    This query may need a Firestore index for `job_posts(createdBy, createdAt)`.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="text-xs text-muted-foreground">
              Showing {list.length} {tab === "mine" ? "of your" : ""} latest posts.
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}

function JobList({
  jobs,
  error,
  emptyLabel,
}: {
  jobs: JobPostDoc[];
  error: string | null;
  emptyLabel: string;
}) {
  if (error) return null;

  if (!jobs.length) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">{emptyLabel}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((j) => (
        <Card key={j.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="text-lg truncate">
                  <Link
                    to={`/job-posts/${encodeURIComponent(j.id)}`}
                    className="hover:underline"
                  >
                    {j.title || "Untitled job"}
                  </Link>
                </CardTitle>
                <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{j.category || "Uncategorized"}</Badge>
                  <Badge variant="outline">₹{Number(j.budget || 0).toLocaleString()}</Badge>
                  {j.status ? <Badge variant="secondary">{j.status}</Badge> : null}
                  {j.createdAt ? (
                    <span className="text-xs text-muted-foreground">{safeDateString(j.createdAt)}</span>
                  ) : null}
                </CardDescription>
              </div>

              <Button asChild variant="outline" size="sm">
                <Link to={`/job-posts/${encodeURIComponent(j.id)}`}>View</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {String(j.description || "").slice(0, 500)}
              {String(j.description || "").length > 500 ? "…" : ""}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
