"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function AdminNav({ role }: { role: string }) {
  const path = usePathname();
  const pages =
    role === "MODERATOR"
      ? ["overview", "content", "generation", "reports", "moderation"]
      : role === "CREATOR_MANAGER"
        ? [
            "overview",
            "creators",
            "content",
            "posts",
            "messages",
            "requests",
            "generation",
            "revenue",
            "analytics",
          ]
        : [
            "overview",
            "users",
            "creators",
            "subscriptions",
            "transactions",
            "content",
            "posts",
            "messages",
            "requests",
            "generation",
            "reports",
            "moderation",
            "audit",
            "configuration",
            "analytics",
          ];
  return (
    <nav className="admin-nav">
      {pages.map((s) => (
        <Link
          key={s}
          href={s === "overview" ? "/admin" : `/admin/${s}`}
          className={
            path === (s === "overview" ? "/admin" : `/admin/${s}`)
              ? "selected"
              : ""
          }
        >
          {s[0].toUpperCase() + s.slice(1)}
        </Link>
      ))}
    </nav>
  );
}
