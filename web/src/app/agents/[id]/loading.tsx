import { SiteHeader } from "@/components/site-header";

// Instant skeleton shown while the agent's detail data is fetched. Next renders
// this the moment you navigate, so entering an agent page never flashes a blank
// screen — the shell appears immediately and real content swaps in.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <SiteHeader variant="back" />

      {/* Identity */}
      <section className="mt-6 flex items-start justify-between gap-4 rounded-2xl glass-strong p-6">
        <div className="flex items-start gap-4">
          <div className="h-[68px] w-[68px] shrink-0 rounded-full bg-white/5 shimmer" />
          <div className="space-y-2.5 pt-1">
            <div className="h-5 w-56 rounded bg-white/8 shimmer" />
            <div className="h-3 w-40 rounded bg-white/5 shimmer" />
            <div className="h-3 w-64 rounded bg-white/5 shimmer" />
          </div>
        </div>
        <div className="hidden h-10 w-44 rounded-xl bg-white/8 shimmer sm:block" />
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={3} />
        </div>
        <div className="flex flex-col gap-5">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    </div>
  );
}

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <section className="card p-5">
      <div className="h-3 w-28 rounded bg-white/8 shimmer" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-white/5 shimmer" style={{ width: `${92 - i * 11}%` }} />
        ))}
      </div>
    </section>
  );
}
