import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, Music, Film } from "lucide-react";
import { db } from "@/lib/db";
import { adultActor } from "@/lib/security";
import { money } from "@/lib/brand";
import { metrics } from "@/services/analytics";
import { EmptyState } from "@/components/ui";
import { ActionButton } from "@/components/member-actions";
import {
  GenerationForm,
  PostForm,
  CreatorEditor,
  DecisionForm,
  SiteConfigForm,
  PaidMessageForm,
} from "@/components/admin-forms";
import type { Role, MediaType, ModerationState } from "@prisma/client";
const roles: Record<string, Role[]> = {
  users: ["ADMIN"],
  creators: ["ADMIN", "CREATOR_MANAGER"],
  subscriptions: ["ADMIN"],
  transactions: ["ADMIN"],
  content: ["ADMIN", "CREATOR_MANAGER", "MODERATOR"],
  posts: ["ADMIN", "CREATOR_MANAGER"],
  messages: ["ADMIN", "CREATOR_MANAGER"],
  requests: ["ADMIN", "CREATOR_MANAGER"],
  generation: ["ADMIN", "CREATOR_MANAGER", "MODERATOR"],
  reports: ["ADMIN", "MODERATOR"],
  moderation: ["ADMIN", "MODERATOR"],
  audit: ["ADMIN"],
  configuration: ["ADMIN"],
  analytics: ["ADMIN", "CREATOR_MANAGER"],
  revenue: ["ADMIN", "CREATOR_MANAGER"],
};
export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = (await params).section;
  if (!roles[s]) notFound();
  const u = await adultActor(roles[s]);
  const q = await searchParams;
  const manage = u.role !== "MODERATOR";
  const moderate = u.role !== "CREATOR_MANAGER";
  const creators = manage
    ? await db.creator.findMany({
        where: { deletedAt: null },
        include: { plans: { where: { active: true } }, settings: true },
        orderBy: { name: "asc" },
      })
    : [];
  if (s === "creators")
    return (
      <>
        <h2 className="subheading">Original worlds, carefully managed.</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CREATOR</th>
                <th>PERSONALITY</th>
                <th>MEMBERSHIP</th>
                <th>CHAT</th>
                <th>PLACEMENT</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div
                      style={{ display: "flex", gap: 12, alignItems: "center" }}
                    >
                      <img
                        src={c.avatar}
                        width={38}
                        height={45}
                        style={{ borderRadius: 6 }}
                        alt=""
                      />
                      <div>
                        {c.name}
                        <small>Fictional AI · Adult {c.age}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {c.category}
                    <small>{c.tags.join(", ")}</small>
                  </td>
                  <td>{money(c.plans[0]?.price || 0)}</td>
                  <td>{c.settings?.chatAccess}</td>
                  <td>{c.featured ? "Featured" : "Directory"}</td>
                  <td>
                    <CreatorEditor creator={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  if (s === "generation") {
    const jobs = await db.generationJob.findMany({
      include: {
        creator: { select: { name: true } },
        prompt: true,
        assets: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return (
      <>
        {manage && <GenerationForm creators={creators} />}
        <h2 className="subheading">Generation & review queue</h2>
        <div className="admin-card" style={{ padding: 0 }}>
          {jobs.length ? (
            jobs.map((j) => (
              <article className="generation-item" key={j.id}>
                <div className="generation-thumb">
                  {j.assets[0] && j.type === "IMAGE" ? (
                    <img
                      src={`/api/admin/assets/${j.assets[0].id}`}
                      alt="Generated safe AI art pending review"
                      style={{
                        height: "100%",
                        width: "100%",
                        objectFit: "cover",
                        borderRadius: 9,
                      }}
                    />
                  ) : j.type === "VOICE" ? (
                    <Music size={24} />
                  ) : j.type === "VIDEO" ? (
                    <Film size={24} />
                  ) : (
                    <Sparkles size={24} />
                  )}
                </div>
                <div>
                  <h3>
                    {j.creator.name} · {j.type}
                  </h3>
                  <p>{j.prompt?.prompt}</p>
                  <p>
                    {j.provider} / {j.model} ·{" "}
                    {j.createdAt.toLocaleString("en-GB")}
                  </p>
                  {j.error && <p className="form-error">{j.error}</p>}
                  {j.type === "VOICE" && j.assets[0] && (
                    <audio
                      src={`/api/admin/assets/${j.assets[0].id}`}
                      controls
                      style={{ width: 220, height: 30, marginTop: 10 }}
                    />
                  )}
                  <span className={`pill ${j.status.toLowerCase()}`}>
                    {j.status}
                  </span>
                </div>
                <div className="list-actions">
                  {j.status === "REVIEW" && moderate && (
                    <>
                      <ActionButton
                        label="Approve asset"
                        endpoint="/api/admin"
                        body={{
                          action: "reviewGeneration",
                          jobId: j.id,
                          approve: true,
                        }}
                      />
                      <ActionButton
                        label="Reject"
                        endpoint="/api/admin"
                        danger
                        body={{
                          action: "reviewGeneration",
                          jobId: j.id,
                          approve: false,
                        }}
                      />
                    </>
                  )}
                  {j.status === "APPROVED" && manage && (
                    <Link className="button secondary" href="/admin/posts">
                      Create a post
                    </Link>
                  )}
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="The next creative chapter awaits."
              body="Create a generation job to begin the review process."
            />
          )}
        </div>
      </>
    );
  }
  if (s === "posts") {
    const media = await db.creatorMedia.findMany({
      where: { moderation: "APPROVED", deletedAt: null },
      select: { id: true, creatorId: true, title: true, type: true },
      orderBy: { createdAt: "desc" },
    });
    const cfg = await db.siteConfiguration.findUniqueOrThrow({
      where: { key: "pricing" },
    });
    const pricing = cfg.value as { ppvMin: number; ppvMax: number };
    return (
      <>
        <PostForm
          creators={creators}
          media={media}
          pricing={{ min: pricing.ppvMin, max: pricing.ppvMax }}
        />
        <PostTable moderate={moderate} />
      </>
    );
  }
  if (s === "content") {
    const type = ["IMAGE", "VIDEO", "VOICE"].includes(q.type || "")
      ? (q.type as MediaType)
      : undefined;
    const state = [
      "DRAFT",
      "REVIEW",
      "APPROVED",
      "REJECTED",
      "HIDDEN",
      "REMOVED",
    ].includes(q.state || "")
      ? (q.state as ModerationState)
      : undefined;
    const media = await db.creatorMedia.findMany({
      where: {
        deletedAt: null,
        ...(q.creator ? { creatorId: q.creator } : {}),
        ...(type ? { type } : {}),
        ...(state ? { moderation: state } : {}),
        ...(q.tag ? { tags: { has: q.tag } } : {}),
        ...(q.used === "unused"
          ? { postMedia: { none: {} } }
          : q.used === "used"
            ? { postMedia: { some: {} } }
            : {}),
      },
      include: {
        creator: { select: { name: true } },
        _count: { select: { postMedia: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <>
        <h2 className="subheading">Content library</h2>
        <form className="discovery-filters">
          <select
            name="creator"
            aria-label="Filter creator"
            defaultValue={q.creator || ""}
          >
            <option value="">All creators</option>
            {(manage
              ? creators
              : await db.creator.findMany({ select: { id: true, name: true } })
            ).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="type"
            aria-label="Media type"
            defaultValue={q.type || ""}
          >
            <option value="">All media</option>
            <option>IMAGE</option>
            <option>VIDEO</option>
            <option>VOICE</option>
          </select>
          <select
            name="state"
            aria-label="Approval state"
            defaultValue={q.state || ""}
          >
            <option value="">All states</option>
            <option>APPROVED</option>
            <option>REVIEW</option>
            <option>REJECTED</option>
          </select>
          <select name="used" aria-label="Usage" defaultValue={q.used || ""}>
            <option value="">All usage</option>
            <option value="unused">Unused</option>
            <option value="used">Used in posts</option>
          </select>
          <input
            className="standard"
            aria-label="Media tag"
            name="tag"
            placeholder="Tag"
            defaultValue={q.tag}
          />
          <button className="button secondary">Filter</button>
        </form>
        <div className="creator-grid">
          {media.map((m) => (
            <article className="creator-card" key={m.id}>
              <div className="creator-photo">
                {m.type === "IMAGE" ? (
                  <img src={`/api/admin/media/${m.id}`} alt={m.title} />
                ) : (
                  <div className="empty-state">
                    <Music size={32} />
                    <audio
                      controls
                      src={`/api/admin/media/${m.id}`}
                      style={{ width: "100%" }}
                    />
                  </div>
                )}
              </div>
              <div className="creator-card-body">
                <h3>{m.title}</h3>
                <p>
                  {m.creator.name} · {m.type}
                </p>
                <p>
                  {m.createdAt.toLocaleDateString("en-GB")} ·{" "}
                  {m._count.postMedia} uses
                </p>
                <span className={`pill ${m.moderation.toLowerCase()}`}>
                  {m.moderation}
                </span>
                <small
                  className="fine-print"
                  style={{ display: "block", marginTop: 9 }}
                >
                  Asset {m.id}
                </small>
              </div>
            </article>
          ))}
        </div>
        <PostTable moderate={moderate} />
      </>
    );
  }
  if (s === "users") {
    const list = await db.user.findMany({
      include: { age: true, settings: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ACCOUNT</th>
              <th>ROLE</th>
              <th>AGE STATE</th>
              <th>STATUS</th>
              <th>PRIVACY</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id}>
                <td>
                  {v.name}
                  <small>{v.email}</small>
                  <small>{v.id}</small>
                </td>
                <td>{v.role}</td>
                <td>{v.age?.state || "UNVERIFIED"}</td>
                <td>
                  <span className={`pill ${v.status.toLowerCase()}`}>
                    {v.status}
                  </span>
                </td>
                <td>
                  {v.settings?.deletionRequestedAt ? (
                    <span className="pill">DELETION REQUESTED</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <DecisionForm
                    type="userStatus"
                    id={v.id}
                    current={v.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (s === "subscriptions") {
    const list = await db.subscription.findMany({
      include: {
        user: { select: { email: true } },
        creator: { select: { name: true } },
        plan: { select: { price: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>MEMBER</th>
              <th>CREATOR</th>
              <th>MONTHLY</th>
              <th>PERIOD END</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id}>
                <td>{v.user.email}</td>
                <td>{v.creator.name}</td>
                <td>{money(v.plan.price)}</td>
                <td>{v.currentPeriodEnd.toLocaleDateString("en-GB")}</td>
                <td>
                  <span className="pill">
                    {v.status}
                    {v.cancelAtPeriodEnd ? " · CANCELING" : ""}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (s === "transactions") {
    const list = await db.payment.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <>
        <div className="notice">
          Mock processor · Reconciled server-side · Refunds reverse ledger
          allocations and revoke associated entitlements.
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TRANSACTION</th>
                <th>MEMBER</th>
                <th>TYPE</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id}>
                  <td>
                    {v.id.slice(0, 12)}
                    <small>{v.createdAt.toLocaleString("en-GB")}</small>
                  </td>
                  <td>{v.user.email}</td>
                  <td>{v.kind}</td>
                  <td>{money(v.amount)}</td>
                  <td>
                    <span className={`pill ${v.status.toLowerCase()}`}>
                      {v.status}
                    </span>
                  </td>
                  <td>
                    {v.status === "PAID" && (
                      <ActionButton
                        label="Refund"
                        endpoint="/api/admin"
                        body={{ action: "refund", paymentId: v.id }}
                        confirm="Refund this demo transaction and revoke its entitlement? The reversal is recorded in the ledger and audit log."
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  if (s === "reports" || s === "moderation") {
    const reports = await db.report.findMany({
      include: {
        user: { select: { email: true } },
        cases: { include: { actions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <>
        <div className="notice">
          Content and user enforcement decisions require ACTIONED status.
          Reports preserve review history and an audited reason.
        </div>
        {reports.length ? (
          reports.map((r) => (
            <article className="admin-card" key={r.id}>
              <div className="section-heading compact">
                <div>
                  <h3>{r.reason}</h3>
                  <p>
                    {r.targetType} · {r.targetId}
                  </p>
                </div>
                <span className="pill">{r.status}</span>
              </div>
              <p style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                {r.detail || "No additional details."}
              </p>
              <p className="fine-print" style={{ marginTop: 15 }}>
                Reported by {r.user.email} ·{" "}
                {r.createdAt.toLocaleString("en-GB")}
              </p>
              <div className="list-actions" style={{ marginTop: 20 }}>
                <DecisionForm type="report" id={r.id} current={r.status} />
              </div>
              {r.cases
                .flatMap((c) => c.actions)
                .map((a) => (
                  <p
                    className="fine-print"
                    key={a.id}
                    style={{ marginTop: 10 }}
                  >
                    {a.action} · {a.reason} ·{" "}
                    {a.createdAt.toLocaleString("en-GB")}
                  </p>
                ))}
            </article>
          ))
        ) : (
          <EmptyState
            title="A clear horizon."
            body="There are no reports to review right now."
          />
        )}
      </>
    );
  }
  if (s === "requests") {
    const list = await db.contentRequest.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const approvedMedia = await db.creatorMedia.findMany({
      where: { moderation: "APPROVED", deletedAt: null },
      select: { id: true, title: true, creatorId: true },
    });
    return list.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>MEMBER</th>
              <th>CREATIVE BRIEF</th>
              <th>PRICE</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id}>
                <td>{v.user.email}</td>
                <td>
                  {v.brief}
                  <small>{v.createdAt.toLocaleString("en-GB")}</small>
                </td>
                <td>{money(v.amount)}</td>
                <td>
                  <span className="pill">{v.status}</span>
                </td>
                <td>
                  <DecisionForm
                    type="request"
                    id={v.id}
                    current={v.status}
                    media={approvedMedia.filter(
                      (m) => m.creatorId === v.creatorId,
                    )}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <EmptyState
        title="A creative idea will arrive soon."
        body="Personal content requests appear here after payment and policy screening."
      />
    );
  }
  if (s === "messages") {
    const conversations = await db.conversation.findMany({
      where: { deletedAt: null },
      include: {
        creator: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    const media = await db.creatorMedia.findMany({
      where: { moderation: "APPROVED", deletedAt: null },
      select: { id: true, creatorId: true, title: true },
    });
    return (
      <PaidMessageForm
        conversations={conversations.map((c) => ({
          id: c.id,
          name: `${c.creator.name} ↔ ${c.user.name}`,
          creatorId: c.creatorId,
        }))}
        media={media}
      />
    );
  }
  if (s === "audit") {
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>TIME</th>
              <th>ACTION</th>
              <th>OPERATOR</th>
              <th>TARGET</th>
              <th>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((v) => (
              <tr key={v.id}>
                <td>{v.createdAt.toLocaleString("en-GB")}</td>
                <td>{v.action}</td>
                <td>{v.operatorId.slice(0, 12)}</td>
                <td>
                  {v.targetType}
                  <small>{v.targetId}</small>
                </td>
                <td>
                  <small>{JSON.stringify(v.metadata)}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (s === "configuration") {
    const [report, pricing] = await Promise.all([
      db.siteConfiguration.findUnique({ where: { key: "reportReasons" } }),
      db.siteConfiguration.findUnique({ where: { key: "pricing" } }),
    ]);
    const p = pricing?.value as { ppvMin: number; ppvMax: number };
    return (
      <SiteConfigForm
        reasons={(report?.value as string[]) || []}
        min={p?.ppvMin || 499}
        max={p?.ppvMax || 4999}
      />
    );
  }
  if (s === "analytics" || s === "revenue") {
    const m = await metrics();
    return (
      <>
        <h2 className="subheading">Creator revenue rankings</h2>
        <div className="admin-card">
          {m.rankings.map((r) => (
            <div className="setting-row" key={r.creatorId}>
              <Link
                href={`/creators/${creators.find((c) => c.id === r.creatorId)?.slug}`}
              >
                {creators.find((c) => c.id === r.creatorId)?.name ||
                  r.creatorId}
              </Link>
              <strong>{money(r._sum.amount || 0)}</strong>
            </div>
          ))}
        </div>
        <h2 className="subheading">First-party event activity</h2>
        <div className="metric-grid">
          {m.events.map((e) => (
            <div key={e.name} className="metric-card">
              <span>{e.name.replaceAll("_", " ")}</span>
              <strong>{e._count}</strong>
              <small>No conversation text in analytics</small>
            </div>
          ))}
        </div>
      </>
    );
  }
  notFound();
}
async function PostTable({ moderate }: { moderate: boolean }) {
  const list = await db.creatorPost.findMany({
    include: { creator: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <h2 className="subheading">Posts & publication</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>POST</th>
              <th>CREATOR</th>
              <th>ACCESS</th>
              <th>STATE</th>
              <th>PUBLICATION</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>{p.creator.name}</td>
                <td>
                  {p.visibility}
                  {p.price > 0 && <small>{money(p.price)}</small>}
                </td>
                <td>
                  <span className={`pill ${p.moderation.toLowerCase()}`}>
                    {p.moderation}
                  </span>
                </td>
                <td>
                  {p.scheduledAt
                    ? "Scheduled"
                    : p.publishedAt
                      ? "Published"
                      : "Draft"}
                  <small>
                    {(p.scheduledAt || p.publishedAt)?.toLocaleString(
                      "en-GB",
                    ) || "—"}
                  </small>
                </td>
                <td>
                  {moderate && (
                    <DecisionForm
                      type="content"
                      id={p.id}
                      current={p.moderation}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
