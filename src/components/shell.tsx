"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  Compass,
  Heart,
  MessageCircle,
  Bell,
  LayoutGrid,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  Settings,
  CreditCard,
  Bookmark,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { api, authClient, toast } from "@/lib/client";
import { Modal, Spinner } from "./ui";
export type ShellUser = { name: string; role: string } | null;
export function Navbar({ user }: { user: ShellUser }) {
  const pathname = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="navbar">
        <Link href="/" className="wordmark">
          {brand.name}
          <span className="brand-star">✦</span>
        </Link>
        <nav className="desktop-nav">
          <Link
            className={pathname.includes("explore") ? "active" : ""}
            href="/explore"
          >
            Discover
          </Link>
          <Link href={user ? "/app/feed" : "/#how-it-works"}>
            {user ? "Your feed" : "The experience"}
          </Link>
          <Link href="/legal/ai-disclosure">
            Our world <span>↗</span>
          </Link>
        </nav>
        <div className="nav-actions">
          <span className="nav-private">
            <ShieldCheck size={13} /> Private by design
          </span>
          {user ? (
            <>
              <Link
                href="/app/messages"
                className="icon-button"
                aria-label="Messages"
              >
                <MessageCircle size={20} />
              </Link>
              <Link href="/app/settings" className="user-avatar">
                {user.name.slice(0, 1)}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="login-link">
                Sign in
              </Link>
              <Link href="/signup" className="button small">
                Join Velora <ArrowUpRight size={15} />
              </Link>
            </>
          )}
          <button
            aria-label="Open navigation"
            className="mobile-menu icon-button"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      {open && (
        <div className="mobile-dropdown">
          <Link onClick={() => setOpen(false)} href="/explore">
            Discover creators
          </Link>
          <Link onClick={() => setOpen(false)} href="/app/feed">
            Your feed
          </Link>
          <Link onClick={() => setOpen(false)} href="/app/messages">
            Messages
          </Link>
          <Link onClick={() => setOpen(false)} href="/app/settings">
            Account & privacy
          </Link>
          {user && (
            <button
              onClick={async () => {
                await authClient.signOut();
                router.push("/");
                router.refresh();
                setOpen(false);
              }}
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div>
        <Link href="/" className="wordmark">
          {brand.name}
          <span className="brand-star">✦</span>
        </Link>
        <p>Extraordinary connections. Entirely imagined.</p>
        <small>
          Fictional AI creators. Real creative possibilities. 18+ only.
        </small>
      </div>
      <div className="footer-links">
        <Link href="/legal/terms">Terms</Link>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/ai-disclosure">AI disclosure</Link>
        <Link href="/legal/content-policy">Content policy</Link>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {brand.name}. A private world of
          possibility.
        </span>
        <span>SAFE DEMO · NO REAL PAYMENTS</span>
      </div>
    </footer>
  );
}
const menu = [
  ["feed", "Your feed", LayoutGrid],
  ["explore", "Explore", Compass],
  ["messages", "Messages", MessageCircle],
  ["subscriptions", "Subscriptions", Bookmark],
  ["favorites", "Favorites", Heart],
  ["notifications", "Notifications", Bell],
  ["purchases", "Purchases", CreditCard],
  ["settings", "Settings", Settings],
] as const;
export function MemberNav({ role }: { role: string }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <>
      <aside className="sidebar">
        <div className="eyebrow">YOUR INNER CIRCLE</div>
        {menu.map(([route, label, Icon]) => (
          <Link
            key={route}
            className={path.endsWith(route) ? "selected" : ""}
            href={route === "explore" ? "/explore" : `/app/${route}`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
        {role !== "USER" && (
          <Link href="/admin">
            <ShieldCheck size={18} />
            Creator studio
          </Link>
        )}
        <button
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut size={18} />
          Sign out
        </button>
        <div className="sidebar-note">
          <ShieldCheck size={20} />
          <p>A space that respects your privacy.</p>
        </div>
      </aside>
      <nav className="bottom-nav">
        {menu.slice(0, 5).map(([route, label, Icon]) => (
          <Link
            key={route}
            aria-label={label}
            className={path.endsWith(route) ? "selected" : ""}
            href={route === "explore" ? "/explore" : `/app/${route}`}
          >
            <Icon size={21} />
            <span>{label.split(" ").at(-1)}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
export function AgeGate({ required }: { required: boolean }) {
  const [open, setOpen] = useState(required),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const path = usePathname();
  if (!open || path.startsWith("/legal/")) return null;
  return (
    <Modal
      title="An extraordinary world. For adults only."
      dismissible={false}
      onClose={() => {}}
    >
      <div className="age-symbol">
        18<span>+</span>
      </div>
      <p>
        VELORA is a private platform for adults aged 18 or older. Every virtual
        creator is fictional, AI-generated, and represented as age 21+.
      </p>
      <label className="check-row">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        I confirm I am 18+ and accept the <Link href="/legal/terms">Terms</Link>{" "}
        and <Link href="/legal/content-policy">Content Policy</Link>.
      </label>
      <p className="fine-print">
        This is self-declaration, not verified identity or governmental age
        verification. All demo media is safe for work.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        disabled={!accepted || busy}
        className="button full"
        onClick={async () => {
          setBusy(true);
          try {
            await api({ confirmed: true, acceptTerms: true }, "/api/age");
            setOpen(false);
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : "Enter your world"}
        <ArrowUpRight size={17} />
      </button>
      <a className="exit-link" href="https://www.wikipedia.org">
        Leave this site
      </a>
    </Modal>
  );
}
export function PrivacyPreferences() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="cookie-control"
        onClick={() => setOpen(true)}
        aria-label="Privacy preferences"
      >
        <ShieldCheck size={14} />
        Privacy
      </button>
      {open && (
        <Modal title="Privacy is a choice." onClose={() => setOpen(false)}>
          <p>
            Essential session and age-declaration cookies keep this demo
            working. Optional analytics is off by default and contains no chat
            content.
          </p>
          <p>
            Change analytics and conversation memory preferences in account
            settings.
          </p>
          <Link
            className="button full"
            href="/app/settings"
            onClick={() => setOpen(false)}
          >
            Manage preferences
          </Link>
          <button
            className="button secondary full"
            onClick={() => {
              setOpen(false);
              toast("Only essential cookies are used by default.");
            }}
          >
            Keep essential only
          </button>
        </Modal>
      )}
    </>
  );
}
