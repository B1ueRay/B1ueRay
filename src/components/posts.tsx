"use client";
import { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowDown } from "lucide-react";
import { AIBadge, LockedMedia, EmptyState, Spinner } from "./ui";
import { CheckoutButton, ReportButton } from "./commerce";
export type PostView = {
  id: string;
  title: string;
  body: string;
  visibility: string;
  price: number;
  creator: { id: string; name: string; slug: string; avatar: string };
  unlocked: boolean;
  createdAt: Date | string | null;
  media: { id: string; url: string; type?: string }[];
};
export function PostCard({
  post,
  planId,
  monthlyPrice,
}: {
  post: PostView;
  planId?: string;
  monthlyPrice?: number;
}) {
  return (
    <article className="post-card">
      <div className="post-header">
        <Link href={`/creators/${post.creator.slug}`}>
          <img src={post.creator.avatar} alt="" />
          <div>
            <strong>{post.creator.name}</strong>
            <span>
              {post.createdAt
                ? new Date(post.createdAt).toLocaleDateString("en-GB", {
                    month: "short",
                    day: "numeric",
                  })
                : "Recently"}{" "}
              · <AIBadge />
            </span>
          </div>
        </Link>
        <span className={`post-tier ${post.visibility.toLowerCase()}`}>
          <Sparkles size={12} />
          {post.visibility === "PUBLIC"
            ? "Preview"
            : post.visibility === "PPV"
              ? "Exclusive"
              : "Inner circle"}
        </span>
      </div>
      {post.unlocked ? (
        <div className="post-media">
          {post.media.map((m) =>
            m.type === "VOICE" ? (
              <audio
                key={m.id}
                src={m.url}
                controls
                aria-label={`AI demo audio for ${post.title}`}
              />
            ) : m.type === "VIDEO" ? (
              <video
                key={m.id}
                src={m.url}
                controls
                preload="metadata"
                aria-label={`AI video for ${post.title}`}
              />
            ) : (
              <img
                key={m.id}
                src={m.url}
                alt={`Safe AI artwork for ${post.title}`}
                loading="lazy"
              />
            ),
          )}
        </div>
      ) : (
        <LockedMedia>
          {post.visibility === "PPV" ? (
            <CheckoutButton kind="PPV" targetId={post.id} price={post.price} />
          ) : planId ? (
            <CheckoutButton
              kind="SUBSCRIPTION"
              targetId={planId}
              price={monthlyPrice || 0}
            />
          ) : (
            <Link className="button" href={`/creators/${post.creator.slug}`}>
              Join the inner circle
            </Link>
          )}
        </LockedMedia>
      )}
      <div className="post-copy">
        <h3>{post.title}</h3>
        <p>{post.body}</p>
        <div className="post-foot">
          <span>
            <Sparkles size={13} /> AI-generated · Fictional adult
          </span>
          <ReportButton targetType="POST" targetId={post.id} />
        </div>
      </div>
    </article>
  );
}
export function Feed({
  initial,
  nextCursor,
}: {
  initial: PostView[];
  nextCursor?: string | null;
}) {
  const [items, setItems] = useState(initial),
    [cursor, setCursor] = useState(nextCursor),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!items.length)
    return (
      <EmptyState
        title="Your world starts with a connection."
        body="Favorite or subscribe to a creator to bring their latest moments into your feed."
      >
        <Link href="/explore" className="button">
          Discover creators
        </Link>
      </EmptyState>
    );
  return (
    <div className="feed-list">
      {items.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {error && <p role="alert">{error}</p>}
      {cursor && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch(
                `/api/feed?cursor=${encodeURIComponent(cursor)}`,
              );
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              setItems([...items, ...d.items]);
              setCursor(d.nextCursor);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : <ArrowDown size={16} />}More moments
        </button>
      )}
    </div>
  );
}
