import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/* Mirrors the CURRENT Souq dashboard (greeting → §TODAY hero + waiting card
   + 4 KPI tiles → §NEEDS YOU triage rows + health ring → §GROW chart + top
   sellers). The previous skeleton modelled an older 4-KPI + 2-chart layout,
   so the page visibly re-flowed when real content arrived. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-7" aria-busy="true" aria-label="Loading dashboard">
      {/* Greeting strip */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="hidden sm:flex gap-2">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
      </div>

      {/* §TODAY */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          {/* Sales hero (navy) */}
          <div className="rounded-2xl bg-navy/90 p-5 space-y-4">
            <Skeleton className="h-4 w-32 bg-white/15" />
            <Skeleton className="h-10 w-48 bg-white/20" />
            <Skeleton className="h-12 w-full bg-white/10" />
          </div>
          {/* Waiting-on-you card */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
        {/* KPI tiles */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* §NEEDS YOU */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardContent className="p-3 space-y-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="rounded-2xl bg-navy/90 p-5 flex items-center gap-5">
            <Skeleton className="h-24 w-24 rounded-full bg-white/15 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28 bg-white/15" />
              <Skeleton className="h-7 w-20 bg-white/20" />
              <Skeleton className="h-3.5 w-full bg-white/10" />
            </div>
          </div>
        </div>
      </section>

      {/* §GROW */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-52" />
        </div>
        <div className="grid gap-4 lg:[grid-template-columns:1.7fr_1fr]">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-[230px] w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-1.5">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
