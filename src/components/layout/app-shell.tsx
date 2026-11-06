"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
const navigationGroups = [
  {
    label: "Daily walk",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reading-plan", label: "My Reading Plan", icon: Map },
      { href: "/bible", label: "Bible Reader", icon: BookOpen },
      { href: "/quiz", label: "Daily Quiz", icon: CircleHelp },
    ],
  },
  {
    label: "Reflect & study",
    items: [
      { href: "/journal", label: "Reflection Journal", icon: NotebookPen },
      { href: "/prayers", label: "Prayer Requests", icon: Heart },
      { href: "/study", label: "Study Tools", icon: Bookmark },
    ],
  },
  {
    label: "Encouragement",
    items: [
      { href: "/challenges", label: "Reading Challenges", icon: Flag },
      { href: "/achievements", label: "Achievements", icon: Award },
      { href: "/community", label: "Community", icon: Users },
    ],
  },
];
const navigation = navigationGroups.flatMap((group) => group.items);
const quickNavigation = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/bible", label: "Read", icon: BookOpen },
  { href: "/quiz", label: "Quiz", icon: CircleHelp },
  { href: "/journal", label: "Journal", icon: NotebookPen },
];
const mobileQuery = "(max-width: 767px)";
function subscribeMobile(change: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    mobileSnapshot,
    () => false,
  );
  const sidebar = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const closeNavigation = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => opener.current?.focus());
  }, []);
  const openNavigation = (event: React.MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setOpen(true);
  };
  const { state, error, profile, mode, refresh, busy } = useJourney();
  useEffect(() => {
    if (!open || !mobile) return;
    sidebar.current?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNavigation();
      }
      if (event.key === "Tab") {
        const controls = [
          ...(sidebar.current?.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), [tabindex='0']",
          ) ?? []),
        ].filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (
          (!event.shiftKey && document.activeElement === last) ||
          !sidebar.current?.contains(document.activeElement)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, mobile, closeNavigation]);
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
          aria-label="Dismiss navigation"
          tabIndex={-1}
          onClick={closeNavigation}
        />
      )}
      <aside
        id="journey-navigation"
        ref={sidebar}
        className={cn("sidebar", open && "sidebar-open")}
        inert={mobile && !open}
        role={mobile && open ? "dialog" : undefined}
        aria-modal={mobile && open ? true : undefined}
        aria-label="Journey navigation"
      >
        <div className="sidebar-brand">
          <Logo />
          <button
            className="mobile-close icon-control"
            aria-label="Close navigation"
            onClick={closeNavigation}
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {navigationGroups.map((group) => (
            <div
              className="nav-section"
              role="group"
              aria-label={group.label}
              key={group.label}
            >
              <span className="nav-caption">{group.label}</span>
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  onClick={() => setOpen(false)}
                  aria-current={pathname === href ? "page" : undefined}
                  href={href}
                  key={href}
                  className={cn("nav-link", pathname === href && "active")}
                >
                  <Icon size={19} strokeWidth={1.7} />
                  {label}
                  {href === "/quiz" && (
                    <span className="nav-new" aria-hidden="true">
                      NEW
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
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
            <Link
              href="/profile"
              aria-label="Open profile"
              onClick={() => setOpen(false)}
            >
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      </aside>
      <div className="app-main" inert={mobile && open}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-control"
              aria-label="Open navigation"
              aria-expanded={open}
              aria-controls="journey-navigation"
              onClick={openNavigation}
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
        <main id="main-content" className="content" tabIndex={-1}>
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
      <nav
        className="mobile-bottom-nav"
        aria-label="Quick navigation"
        inert={mobile && open}
      >
        {quickNavigation.map(({ href, label, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className={cn("quick-link", pathname === href && "active")}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon size={21} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={cn(
            "quick-link",
            !quickNavigation.some((item) => item.href === pathname) && "active",
          )}
          aria-label="More navigation"
          aria-controls="journey-navigation"
          aria-expanded={open}
          onClick={openNavigation}
        >
          <Menu size={21} aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
