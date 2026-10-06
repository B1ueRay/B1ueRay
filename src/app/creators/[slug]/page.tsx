import Link from "next/link";
import { EventTracker } from "@/components/event-tracker";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft, Globe, Sparkles, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { subscribed, postFeed } from "@/services/entitlements";
import { AIBadge } from "@/components/ui";
import {
  CheckoutButton,
  FavoriteButton,
  MessageButton,
  ReportButton,
} from "@/components/commerce";
import { PostCard } from "@/components/posts";
import { Footer } from "@/components/shell";
import { money } from "@/lib/brand";
export default async function Profile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const c = await db.creator.findFirst({
    where: {
      slug: (await params).slug,
      moderation: "APPROVED",
      deletedAt: null,
    },
    include: {
      plans: { where: { active: true } },
      settings: true,
      _count: {
        select: {
          posts: { where: { moderation: "APPROVED" } },
          media: { where: { moderation: "APPROVED" } },
        },
      },
    },
  });
  if (!c) notFound();
  const session = await auth.api.getSession({ headers: await headers() });
  const u = session
    ? await db.user.findFirst({
        where: { id: session.user.id, status: "ACTIVE" },
        include: { age: true, settings: true },
      })
    : null;
  const uid =
    u?.age && ["SELF_DECLARED", "VERIFIED"].includes(u.age.state)
      ? u.id
      : undefined;
  const [active, favorite, feed] = await Promise.all([
    uid ? subscribed(uid, c.id) : false,
    uid
      ? db.favorite.findUnique({
          where: { userId_creatorId: { userId: uid, creatorId: c.id } },
        })
      : null,
    postFeed(uid, { creatorId: c.id }),
  ]);
  const plan = c.plans[0];
  return (
    <>
      <main className="profile-page page-container">
        {u?.settings?.analyticsConsent && (
          <EventTracker name="creator_view" creatorId={c.id} />
        )}
        <Link href="/explore" className="back-link">
          <ArrowLeft size={15} />
          Back to discovery
        </Link>
        <section className="profile-hero">
          <div className="profile-art">
            <img
              src={c.cover}
              alt={`${c.name}, fictional AI creator age ${c.age}`}
            />
            <div className="profile-art-label">
              <AIBadge />
              <span>FICTIONAL ADULT · {c.age}</span>
            </div>
          </div>
          <div className="profile-intro">
            <div className="eyebrow">YOUR NEXT CONNECTION</div>
            <h1>
              {c.name}
              <Sparkles size={24} />
            </h1>
            <div className="profile-badges">
              <AIBadge />
              <span>{c.age} years · Adult 21+</span>
              <span>{c.category}</span>
            </div>
            <p className="profile-bio">{c.bio}</p>
            <div className="profile-tags">
              {c.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <div className="profile-facts">
              <span>
                <Globe size={16} />
                {c.languages.join(" / ")}
              </span>
              <span>{c._count.media} art studies</span>
            </div>
            <div className="profile-offer">
              <div>
                <span>YOUR INNER CIRCLE</span>
                <strong>
                  {money(plan?.price || 0)}
                  <small> / month</small>
                </strong>
              </div>
              {active ? (
                <Link href="/app/subscriptions" className="button secondary">
                  <ShieldCheck size={16} />
                  You’re in the inner circle
                </Link>
              ) : (
                plan && (
                  <CheckoutButton
                    kind="SUBSCRIPTION"
                    targetId={plan.id}
                    price={plan.price}
                    creatorName={c.name}
                    label="Join the inner circle"
                  />
                )
              )}
            </div>
            <div className="profile-secondary">
              <MessageButton creatorId={c.id} />
              <FavoriteButton creatorId={c.id} initial={!!favorite} label />
            </div>
            <div className="ai-disclosure-inline">
              <Sparkles size={17} />
              <p>
                {c.aiDisclosure} Conversations are AI simulations, never a human
                relationship.
              </p>
            </div>
            <ReportButton targetType="CREATOR" targetId={c.id} />
          </div>
        </section>
        <div className="profile-body">
          <div>
            <div className="section-heading compact">
              <h2>
                From {c.name.split(" ")[0]}’s <em>world.</em>
              </h2>
              <span>{c._count.posts} moments</span>
            </div>
            <div className="profile-feed">
              {feed.items.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  planId={plan?.id}
                  monthlyPrice={plan?.price}
                />
              ))}
            </div>
          </div>
          <aside className="about-card">
            <div className="eyebrow">GET A LITTLE CLOSER</div>
            <h3>About {c.name.split(" ")[0]}</h3>
            <p>
              {c.bio} An original fictional personality with a love for{" "}
              {c.tags.join(", ")}.
            </p>
            <h4>Something more personal?</h4>
            <p>
              Send a thoughtful tip or request a safe, custom AI art study. Our
              studio reviews every creative brief.
            </p>
            <CheckoutButton
              kind="TIP"
              tipBounds={
                c.settings
                  ? { min: c.settings.tipMin, max: c.settings.tipMax }
                  : undefined
              }
              targetId={c.id}
              price={500}
              label="Send a tip"
              className="button secondary full"
            />
            <CheckoutButton
              kind="REQUEST"
              targetId={c.id}
              price={c.settings?.requestStartingPrice || 2999}
              label="Request a creative moment"
              className="button secondary full"
            />
            <div className="privacy-small">
              <ShieldCheck size={16} />
              Your privacy is always part of the picture.
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
