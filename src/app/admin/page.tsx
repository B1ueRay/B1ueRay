import Link from "next/link";
import { adultActor } from "@/lib/security";
import { db } from "@/lib/db";
import { metrics } from "@/services/analytics";
import { money } from "@/lib/brand";
export default async function Dashboard() {
  const u = await adultActor(["ADMIN", "CREATOR_MANAGER", "MODERATOR"]);
  if (u.role === "MODERATOR") {
    const [reports, jobs] = await Promise.all([
      db.report.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      db.generationJob.count({ where: { status: "REVIEW" } }),
    ]);
    return (
      <div className="metric-grid">
        <div className="metric-card">
          <span>Reports to review</span>
          <strong>{reports}</strong>
          <Link href="/admin/reports">Open reports →</Link>
        </div>
        <div className="metric-card">
          <span>Generated assets in review</span>
          <strong>{jobs}</strong>
          <Link href="/admin/generation">Review assets →</Link>
        </div>
      </div>
    );
  }
  const m = await metrics();
  const cards = [
    ["Registered users", String(m.users), "All accounts"],
    ["Active users", String(m.activeUsers), "Users with current sessions"],
    [
      "Active memberships",
      String(m.subscribers),
      "Unexpired paid subscriptions",
    ],
    ["MRR", money(m.mrr), "At current plan prices · demo"],
    ["GMV", money(m.gmv), "Paid, excluding refunds · demo"],
    ["ARPPU", money(m.arppu), "Gross per paying user · demo"],
    ["Paid conversion", `${m.conversion}%`, "Paying users / registered users"],
    ["Cancellation intent", `${m.churn}%`, "Active memberships set to cancel"],
    ["Messages sent", String(m.messages), "User messages only"],
    ["PPV + paid notes", money(m.ppv), "Combined unlock revenue · demo"],
    ["Tip revenue", money(m.tips), "Confirmed tips · demo"],
    ["Moderation queue", String(m.queue), "Open and in-review reports"],
  ];
  return (
    <>
      <div className="notice">
        Live development metrics. Mock payments have no monetary value. MRR uses
        current plan prices; cancellation intent is a proxy, not historical
        churn.
      </div>
      <div className="metric-grid">
        {cards.map(([title, value, note]) => (
          <div className="metric-card" key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="admin-card">
        <h3>Keep the creative cycle moving</h3>
        <p className="page-intro">
          Generate → Moderate → Review → Approve → Publish. Every sensitive
          decision creates an audit record.
        </p>
        <div className="list-actions" style={{ marginTop: 20 }}>
          <Link className="button" href="/admin/generation">
            Create a generation job
          </Link>
          <Link className="button secondary" href="/admin/posts">
            Create a post
          </Link>
          <Link className="button secondary" href="/admin/reports">
            Review reports
          </Link>
        </div>
      </div>
    </>
  );
}
