import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, ArrowUpRight, Download, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { adultActor } from "@/lib/security";
import { money } from "@/lib/brand";
import { postFeed } from "@/services/entitlements";
import { readMessages } from "@/services/chat";
import { CreatorCard } from "@/components/creator-card";
import { Feed } from "@/components/posts";
import { EmptyState } from "@/components/ui";
import {
  ActionButton,
  SettingsForm,
  BlockForm,
  PasswordForm,
} from "@/components/member-actions";
import { CheckoutButton } from "@/components/commerce";
import { ChatWindow } from "@/components/chat-window";
const titles: Record<string, [string, string]> = {
  feed: [
    "Your private world.",
    "The latest moments from your favorite creators.",
  ],
  favorites: [
    "A few of your favorites.",
    "Personalities you’ll want to come back to.",
  ],
  subscriptions: ["Your inner circle.", "Manage the worlds you’re part of."],
  notifications: [
    "A little something new.",
    "Updates from your private world.",
  ],
  purchases: [
    "Moments, collected.",
    "Your exclusive purchases and thoughtful gestures.",
  ],
  settings: ["On your terms.", "Your account, your privacy, your choices."],
  account: ["Your account.", "Private by design. Protected by you."],
  billing: [
    "A clear picture.",
    "Transparent demo payments and your purchase history.",
  ],
  privacy: [
    "Privacy is personal.",
    "Control your conversation memory and your data.",
  ],
  "blocked-users": [
    "Your boundaries.",
    "Manage accounts you have chosen to block.",
  ],
  messages: ["Private conversations.", "A little curiosity goes a long way."],
};
export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ conversation?: string }>;
}) {
  const s = (await params).section;
  if (!titles[s]) notFound();
  const u = await adultActor();
  const [title, desc] = titles[s];
  let content;
  if (s === "feed") {
    const f = await postFeed(u.id, { following: true });
    content = <Feed initial={f.items} nextCursor={f.nextCursor} />;
  } else if (s === "favorites") {
    const fav = await db.favorite.findMany({
      where: {
        userId: u.id,
        creator: { moderation: "APPROVED", deletedAt: null },
      },
      include: { creator: { include: { plans: { where: { active: true } } } } },
    });
    content = fav.length ? (
      <div className="creator-grid">
        {fav.map((f) => (
          <CreatorCard key={f.id} creator={{ ...f.creator, favorited: true }} />
        ))}
      </div>
    ) : (
      <EmptyState
        title="Save a spark."
        body="Favorite creators to keep their worlds close."
      >
        <Link className="button" href="/explore">
          Discover creators
        </Link>
      </EmptyState>
    );
  } else if (s === "subscriptions") {
    const subs = await db.subscription.findMany({
      where: { userId: u.id },
      include: { creator: true, plan: true },
      orderBy: { createdAt: "desc" },
    });
    content = subs.length ? (
      <>
        <div className="notice">
          Demo memberships last 30 days. Cancellation preserves access until the
          end of the current period. Renewal is manual in this MVP.
        </div>
        {subs.map((sub) => (
          <article className="list-card" key={sub.id}>
            <img src={sub.creator.avatar} alt="" />
            <div className="list-info">
              <Link href={`/creators/${sub.creator.slug}`}>
                <h3>{sub.creator.name}</h3>
              </Link>
              <p>
                {money(sub.plan.price)} / month · Through{" "}
                {sub.currentPeriodEnd.toLocaleDateString("en-GB")}
              </p>
              <span className={`pill ${sub.status.toLowerCase()}`}>
                {sub.currentPeriodEnd < new Date()
                  ? "EXPIRED"
                  : sub.cancelAtPeriodEnd
                    ? "CANCELS AT PERIOD END"
                    : sub.status}
              </span>
            </div>
            <div className="list-actions">
              {!sub.cancelAtPeriodEnd &&
                sub.currentPeriodEnd > new Date() &&
                sub.status === "ACTIVE" && (
                  <ActionButton
                    label="Cancel renewal"
                    body={{
                      action: "cancelSubscription",
                      subscriptionId: sub.id,
                    }}
                    confirm="Stop renewal at the end of this membership period? Your current access stays available until then."
                  />
                )}
              {sub.currentPeriodEnd <= new Date() && !sub.cancelAtPeriodEnd && (
                <CheckoutButton
                  kind="RENEWAL"
                  targetId={sub.planId}
                  price={sub.plan.price}
                  label="Renew membership"
                />
              )}
              <Link
                className="button secondary"
                href={`/creators/${sub.creator.slug}`}
              >
                Visit creator
              </Link>
            </div>
          </article>
        ))}
      </>
    ) : (
      <EmptyState
        title="Your inner circle awaits."
        body="Join a creator’s membership for access to their private posts."
      >
        <Link className="button" href="/explore">
          Find your connection
        </Link>
      </EmptyState>
    );
  } else if (s === "notifications") {
    const list = await db.notification.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    content = list.length ? (
      <>
        <div className="list-actions" style={{ marginBottom: 20 }}>
          <ActionButton
            label="Mark all as read"
            body={{ action: "notificationsRead" }}
          />
        </div>
        {list.map((n) => (
          <Link
            className={`list-card ${!n.readAt ? "notification-unread" : ""}`}
            key={n.id}
            href={n.href}
          >
            <div className="notification-icon">
              <Bell size={20} />
            </div>
            <div className="list-info">
              <h3>{n.title}</h3>
              <p>{n.body}</p>
              <small className="fine-print">
                {n.createdAt.toLocaleString("en-GB")}
              </small>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </>
    ) : (
      <EmptyState
        title="A quiet moment."
        body="Your creator updates and purchase confirmations will appear here."
      />
    );
  } else if (s === "purchases" || s === "billing") {
    const [payments, requests] = await Promise.all([
      db.payment.findMany({
        where: { userId: u.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.contentRequest.findMany({
        where: { userId: u.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    content = (
      <>
        <div className="notice">
          This is a demo ledger. Transactions have no real monetary value. No
          card details are collected.
        </div>
        {payments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>EXPERIENCE</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th>REFERENCE</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.createdAt.toLocaleDateString("en-GB")}</td>
                    <td>{p.kind.replaceAll("_", " ")}</td>
                    <td>{money(p.amount)}</td>
                    <td>
                      <span className={`pill ${p.status.toLowerCase()}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <small>{p.id.slice(0, 12)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Your collection starts here."
            body="Purchased posts, paid notes, and tips will appear here."
          />
        )}
        {requests.length > 0 && (
          <>
            <h2 className="subheading">Personal creative requests</h2>
            {requests.map((r) => (
              <div className="list-card" key={r.id}>
                <div className="list-info">
                  <h3>{r.brief}</h3>
                  <p>
                    {money(r.amount)} ·{" "}
                    {r.createdAt.toLocaleDateString("en-GB")}
                  </p>
                </div>
                <span className="pill">{r.status}</span>
                {r.status === "COMPLETED" && r.fulfilledMediaId && (
                  <a
                    className="button secondary"
                    href={`/api/media/${r.fulfilledMediaId}`}
                  >
                    View your creative moment
                  </a>
                )}
              </div>
            ))}
          </>
        )}
      </>
    );
  } else if (s === "messages") {
    const list = await db.conversation.findMany({
      where: {
        userId: u.id,
        deletedAt: null,
        creator: { deletedAt: null, moderation: "APPROVED" },
      },
      include: { creator: { select: { name: true, avatar: true } } },
      orderBy: { updatedAt: "desc" },
    });
    const selected = (await searchParams).conversation;
    const match =
      selected && list.some((c) => c.id === selected) ? selected : undefined;
    const chat = match ? await readMessages(u.id, match) : null;
    content = (
      <>
        <div
          className={`chat-layout ${!chat ? "no-chat" : ""}`}
          data-chat={!!chat}
        >
          <aside className="conversation-list">
            <div className="eyebrow">YOUR CONVERSATIONS</div>
            {list.map((c) => (
              <Link
                key={c.id}
                className={c.id === match ? "selected" : ""}
                href={`/app/messages?conversation=${c.id}`}
              >
                <img src={c.creator.avatar} alt="" />
                <div>
                  <strong>{c.creator.name}</strong>
                  <small>Fictional AI creator</small>
                </div>
              </Link>
            ))}
            {!list.length && (
              <div style={{ padding: 20 }}>
                <p className="fine-print">
                  Find a creator to start a private conversation.
                </p>
                <Link className="button small" href="/explore">
                  Explore creators
                </Link>
              </div>
            )}
          </aside>
          {chat ? (
            <ChatWindow key={chat.id} initial={chat} />
          ) : (
            <div className="chat-no-selection">
              <EmptyState
                title="A conversation, waiting."
                body="Choose a conversation or discover someone new."
              >
                <Link className="button" href="/explore">
                  <MessageCircle size={16} />
                  Meet your next connection
                </Link>
              </EmptyState>
            </div>
          )}
        </div>
        <Link
          className="back-link"
          style={{ marginTop: 20 }}
          href="/app/messages"
        >
          All conversations
        </Link>
      </>
    );
  } else {
    const [settings, blocked] = await Promise.all([
      db.userSettings.findUnique({ where: { userId: u.id } }),
      db.blockedUser.findMany({ where: { userId: u.id } }),
    ]);
    content = (
      <div className="settings-grid">
        <section className="settings-card">
          <h3>{u.name}</h3>
          <p>{u.email}</p>
          <div className="privacy-details">
            Account ID: {u.id}
            <br />
            Age state: {u.age?.state || "UNVERIFIED"} · Self-declaration is
            separate from verified identity.
            <br />
            Role: {u.role}
          </div>
          <div className="list-actions">
            <Link href="/app/account" className="button secondary">
              Account
            </Link>
            <Link href="/app/billing" className="button secondary">
              Billing
            </Link>
            <Link href="/app/privacy" className="button secondary">
              Privacy
            </Link>
            <Link href="/app/blocked-users" className="button secondary">
              Blocked users
            </Link>
          </div>
        </section>
        <SettingsForm
          settings={{
            memoryEnabled: settings?.memoryEnabled ?? true,
            analyticsConsent: settings?.analyticsConsent ?? false,
            emailNotifications: settings?.emailNotifications ?? false,
          }}
        />
        <PasswordForm />
        <section className="settings-card">
          <h3>Your data belongs to you.</h3>
          <p>
            Export your account data or remove conversation memory. Conversation
            deletion is available inside each chat.
          </p>
          <div className="list-actions">
            <a className="button secondary" href="/api/export">
              <Download size={15} />
              Export account data
            </a>
            <ActionButton
              label="Clear all memory"
              body={{ action: "clearMemory" }}
              confirm="Clear saved preferences from every conversation? Chat messages will remain."
            />
          </div>
        </section>
        <section className="settings-card">
          <h3>Blocked accounts</h3>
          <p>
            Public user-to-user interaction is not enabled in this proprietary
            creator MVP. Blocks are stored for future community interactions.
          </p>
          <BlockForm />
          {blocked.map((b) => (
            <div className="setting-row" key={b.id}>
              <span>{b.blockedUserId}</span>
              <ActionButton
                label="Unblock"
                body={{
                  action: "block",
                  blockedUserId: b.blockedUserId,
                  remove: true,
                }}
              />
            </div>
          ))}
        </section>
        <section className="settings-card">
          <h3>Account deletion</h3>
          <p>
            Request a deletion review. Accounting and moderation records may
            require retention. This does not silently delete financial records.
          </p>
          {settings?.deletionRequestedAt ? (
            <p className="form-error">
              Deletion requested on{" "}
              {settings.deletionRequestedAt.toLocaleDateString("en-GB")}.
              Awaiting staff review.
            </p>
          ) : (
            <ActionButton
              label="Request account deletion"
              danger
              body={{ action: "deleteAccount" }}
              confirm="Submit an account deletion request for staff review? You can still access your account while the request is pending."
            />
          )}
        </section>
      </div>
    );
  }
  return (
    <>
      <div className="member-heading">
        <div>
          <div className="eyebrow">YOUR VELORA</div>
          <h1>{title}</h1>
          <p className="page-intro">{desc}</p>
        </div>
        <Link href="/explore" className="text-link">
          Discover creators <ArrowUpRight size={16} />
        </Link>
      </div>
      {content}
    </>
  );
}
