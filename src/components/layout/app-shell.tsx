"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Map,
  BookOpen,
  CircleHelp,
  NotebookPen,
  Award,
  Users,
  Settings,
  ArrowUpRight,
  Menu,
  X,
  Sprout,
  Sun,
  Moon,
  Bookmark,
  Flag,
  Heart,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { useJourney } from "@/components/journey-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LegalLinks } from "@/components/legal-links";
import { SiteSignature } from "@/components/site-signature";
const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reading-plan", label: "My Reading Plan", icon: Map },
  { href: "/bible", label: "Bible Reader", icon: BookOpen },
  { href: "/challenges", label: "Reading Challenges", icon: Flag },
  { href: "/study", label: "Study Tools", icon: Bookmark },
  { href: "/quiz", label: "Daily Quiz", icon: CircleHelp },
  { href: "/prayers", label: "Prayer Requests", icon: Heart },
  { href: "/journal", label: "Reflection Journal", icon: NotebookPen },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/community", label: "Community", icon: Users },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { state, error, profile, mode, refresh, busy } = useJourney();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const current =
    navigation.find((n) => n.href === pathname)?.label ?? "Profile & Settings";
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={cn("sidebar", open && "sidebar-open")}>
        <div className="sidebar-brand">
          <Logo short />
          <button
            className="mobile-close icon-control"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <span className="nav-caption">YOUR JOURNEY</span>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              onClick={() => setOpen(false)}
              aria-current={pathname === href ? "page" : undefined}
              href={href}
              key={href}
              className={cn("nav-link", pathname === href && "active")}
            >
              <Icon size={19} strokeWidth={1.7} />
              {label}
              {href === "quiz" && <span className="nav-new">NEW</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <Sprout size={25} />
            <p>
              A little time in the Word.
              <br />A little closer, every day.
            </p>
            <span>GROW AT YOUR OWN PACE</span>
          </div>
          <Link
            href="/profile"
            className={cn("nav-link", pathname === "/profile" && "active")}
            onClick={() => setOpen(false)}
          >
            <Settings size={19} />
            Profile & Settings
          </Link>
          <div className="sidebar-profile">
            <span className="avatar">
              {state?.profile.name.slice(0, 1).toUpperCase() ?? "F"}
            </span>
            <div>
              <strong>{state?.profile.name ?? "Faith Explorer"}</strong>
              <small>
                {mode === "demo" ? "Local demo account" : "Private account"}
              </small>
            </div>
            <Link href="/profile" aria-label="Open profile">
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-control"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb-home">
              My journey <span>/</span>
            </span>
            <strong>{current}</strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-pill">
              <span />
              {mode === "demo" ? "DEMO MODE" : "MY ACCOUNT"}
            </span>
            <button
              className="icon-control"
              aria-label="Toggle color theme"
              onClick={() => {
                if (state)
                  void profile({
                    ...state.profile,
                    theme:
                      document.documentElement.dataset.theme === "dark"
                        ? "light"
                        : "dark",
                  });
              }}
            >
              <Sun className="sun-icon" size={19} />
              <Moon className="moon-icon" size={19} />
            </button>
            <Link
              href="/profile"
              className="avatar avatar-small"
              aria-label="Profile and settings"
            >
              {state?.profile.name.slice(0, 1).toUpperCase() ?? "F"}
            </Link>
          </div>
        </header>
        <main id="main-content" className="content">
          {error && (
            <div className="error-banner" role="alert">
              {error}{" "}
              {mode === "demo"
                ? "Changes that could not be saved have not been applied."
                : "Please retry or refresh to check the latest saved progress."}
              {mode === "supabase" && refresh && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void refresh()}
                >
                  {busy ? "Checking…" : "Check saved progress"}
                </Button>
              )}
            </div>
          )}
          {children}
          <footer className="app-footer">
            <span>
              Read. Discover. Grow in Faith.
              <SiteSignature />
            </span>
            <LegalLinks />
            <span>
              {mode === "demo"
                ? "Demo progress is saved in this browser only."
                : "Your progress is saved to your private account."}{" "}
              <Link href="/profile">
                Your preferences <ArrowUpRight size={12} />
              </Link>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
