import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HiredNavLink } from "./hired-nav-link";

// One shared, refined header so every page reads as the same product. Two
// modes: the marketplace home, and a "back to marketplace" mode for detail
// pages. Kept a server component (no client cost) — wallet state lives in the
// pages that need it.
export function SiteHeader({ variant = "home" }: { variant?: "home" | "back" }) {
  return (
    <header className="sticky top-3 z-50 mt-3 flex items-center justify-between gap-3 rounded-2xl glass-strong px-5 py-3">
      {variant === "back" ? (
        <Link href="/" className="flex items-center gap-2 text-sm text-muted transition hover:text-fg">
          <ArrowLeft size={16} /> Marketplace
        </Link>
      ) : (
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg text-violet">◆</span>
          <span className="text-lg font-semibold tracking-tight text-cosmic">Proven</span>
          <span className="ml-1 hidden rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-muted sm:inline">
            BNB Smart Chain
          </span>
        </Link>
      )}

      <nav className="flex items-center gap-1.5 sm:gap-3">
        {variant === "home" ? (
          <>
            <Link href="/advantage" className="hidden text-sm text-muted transition hover:text-fg sm:inline">Advantage</Link>
            <HiredNavLink />
            <Link
              href="/build"
              className="rounded-xl bg-linear-to-r from-violet to-magenta px-4 py-1.5 text-sm font-medium text-white glow-violet transition hover:brightness-110"
            >
              Build a flow
            </Link>
          </>
        ) : (
          <>
            <HiredNavLink />
            <Link href="/" className="hidden items-center gap-1.5 text-lg font-semibold text-cosmic sm:flex">
              <span className="text-violet">◆</span> Proven
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
