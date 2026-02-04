import { ExternalLink, Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

export default function ChatDetails({ otherProfile, activeChat, onViewOrder, onReport, onBlock }) {
  const order = activeChat?.order || null;
  const hasOrder = Boolean(order?.id);

  const displayName = otherProfile?.name || otherProfile?.username || "User";
  const username = otherProfile?.username ? `@${otherProfile.username}` : "";
  const role = otherProfile?.role || "";
  const online = typeof otherProfile?.online === "boolean" ? otherProfile.online : null;

  const memberSince = (() => {
    const ts = otherProfile?.createdAt || otherProfile?.memberSince;
    const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
    return d ? d.toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "—";
  })();

  const activity = online === true ? "Online" : online === false ? "Offline" : "Active";

  const stats = {
    completedOrders: Number(otherProfile?.completedOrders ?? 0),
    avgRating: otherProfile?.avgRating ?? "—",
    completionRate: otherProfile?.completionRate ?? "—",
  };

  return (
    <div className="h-full min-h-0">
      <Card className="h-full min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-200">
          <CardTitle className="text-base text-slate-900">Orders with you</CardTitle>
        </CardHeader>
        <CardContent className="h-full min-h-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={otherProfile?.photoURL || ""} alt={displayName} />
                      <AvatarFallback>{initials(displayName)}</AvatarFallback>
                    </Avatar>
                    <span
                      className={
                        online === true
                          ? "absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white"
                          : online === false
                            ? "absolute bottom-0 right-0 h-3 w-3 rounded-full bg-slate-400 ring-2 ring-white"
                            : "absolute bottom-0 right-0 h-3 w-3 rounded-full bg-slate-300 ring-2 ring-white"
                      }
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">{displayName}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      {username ? <span className="truncate">{username}</span> : null}
                      {role ? <span className="truncate">· {role}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <div className="text-[11px] text-slate-500">Member since</div>
                    <div className="mt-0.5 text-sm font-medium text-slate-900">{memberSince}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <div className="text-[11px] text-slate-500">Activity</div>
                    <div className="mt-0.5 text-sm font-medium text-slate-900">{activity}</div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">Completed</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{stats.completedOrders}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">Avg rating</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{stats.avgRating}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-[11px] text-slate-500">Completion</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{stats.completionRate}</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-slate-900">Order</div>
                <Badge variant="secondary">{hasOrder ? (order.status || "Active") : "None"}</Badge>
              </div>

          {hasOrder ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-slate-500">Gig purchased</div>
                <div className="text-sm font-medium text-slate-900 truncate">{order.gigTitle || "—"}</div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-slate-500">Order ID</div>
                <div className="text-sm font-mono text-slate-900">{order.id}</div>
              </div>
              <Separator />

              <div className="grid gap-2">
                <Button
                  variant="outline"
                  className="justify-start border-slate-200"
                  onClick={() => onReport?.()}
                >
                  <Info className="h-4 w-4" />
                  Tell me more
                </Button>
                <Button
                  variant="outline"
                  className="justify-start border-slate-200"
                  disabled={!hasOrder}
                  onClick={() => onViewOrder?.(order)}
                >
                  <ExternalLink className="h-4 w-4" />
                  View order
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No order linked to this conversation yet.
            </div>
          )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
