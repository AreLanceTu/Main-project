import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

import Navbar from "@/components/layout/Navbar";
import { auth } from "@/firebase";
import MessagesPage from "@/pages/MessagesPage";

export default function Messages() {
  const [uid, setUid] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  return (
    <>
      <Helmet>
        <title>Messages - GigFlow</title>
      </Helmet>

      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <main className="flex-1 min-h-0 w-full overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
          <div className="flex-1 min-h-0">
            <MessagesPage currentUid={uid} />
          </div>
        </main>
      </div>
    </>
  );
}
