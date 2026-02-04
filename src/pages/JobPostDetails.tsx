import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { auth, db } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

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

export default function JobPostDetails() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const jobId = String(params.id || "");

  const [uid, setUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  const [job, setJob] = useState<JobPostDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!jobId) {
      setError("Missing job id");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      doc(db, "job_posts", jobId),
      (snap) => {
        if (!snap.exists()) {
          setJob(null);
          setError("Job not found");
          setLoading(false);
          return;
        }

        const data: any = snap.data() || {};
        setJob({
          id: snap.id,
          title: String(data.title || ""),
          category: String(data.category || ""),
          budget: Number(data.budget || 0),
          description: String(data.description || ""),
          status: String(data.status || "open"),
          createdBy: String(data.createdBy || ""),
          createdAt: data.createdAt,
        });
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load job", err);
        setJob(null);
        setError(err?.message || "Failed to load job");
        setLoading(false);
      },
    );

    return () => unsub();
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !uid) {
      setApplied(false);
      return;
    }

    const appId = `${jobId}_${uid}`;
    const unsub = onSnapshot(
      doc(db, "job_applications", appId),
      (snap) => setApplied(snap.exists()),
      () => setApplied(false),
    );

    return () => unsub();
  }, [jobId, uid]);

  const isOwner = useMemo(() => Boolean(uid && job?.createdBy && uid === job.createdBy), [job?.createdBy, uid]);

  const messageHref = useMemo(() => {
    const withUid = job?.createdBy;
    if (!withUid) return "/messages";
    return `/messages?with=${encodeURIComponent(withUid)}`;
  }, [job?.createdBy]);

  async function apply() {
    if (!jobId || !uid) return;
    if (!job) return;
    if (isOwner) {
      toast({ title: "You own this job", description: "You can’t apply to your own post.", variant: "destructive" });
      return;
    }
    if (applied) return;

    try {
      setApplying(true);
      const appId = `${jobId}_${uid}`;
      await setDoc(
        doc(db, "job_applications", appId),
        {
          jobId,
          applicantId: uid,
          clientId: job.createdBy,
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      toast({ title: "Applied", description: "Your application was sent." });
    } catch (e: any) {
      toast({ title: "Could not apply", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>Job Details - GigFlow</title>
        <meta name="description" content="Job post details" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />

        <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 sm:py-10">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                Back
              </Button>
              <Button variant="outline" asChild>
                <Link to="/job-posts">All job posts</Link>
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{job?.title || (loading ? "Loading…" : "Job details")}</CardTitle>
                <CardDescription>
                  {job?.category ? <Badge variant="outline">{job.category}</Badge> : null}{" "}
                  {job ? <Badge variant="outline">₹{Number(job.budget || 0).toLocaleString()}</Badge> : null}{" "}
                  {job?.status ? <Badge variant="secondary">{job.status}</Badge> : null}{" "}
                  {job?.createdAt ? <span className="ml-2 text-xs text-muted-foreground">{safeDateString(job.createdAt)}</span> : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error ? <div className="text-sm text-destructive">{error}</div> : null}

                <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                  {job?.description || (loading ? "Loading…" : "")}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button asChild disabled={!job?.createdBy}>
                    <Link to={messageHref}>Message client</Link>
                  </Button>

                  <Button
                    type="button"
                    onClick={apply}
                    disabled={!job || !uid || applying || applied || isOwner}
                  >
                    {isOwner ? "Your job" : applied ? "Applied" : applying ? "Applying…" : "Apply"}
                  </Button>

                  {isOwner ? (
                    <Button variant="outline" asChild>
                      <Link to="/job-post">Post another job</Link>
                    </Button>
                  ) : null}
                </div>

                <div className="text-xs text-muted-foreground">
                  Note: Applications are stored in Firestore (collection `job_applications`).
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
