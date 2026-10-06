"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  LockKeyhole,
  ArrowUpRight,
  MessageCircle,
  Flag,
  Gift,
  ShieldCheck,
} from "lucide-react";
import { api, toast } from "@/lib/client";
import { money } from "@/lib/brand";
import { Modal, Spinner } from "./ui";
export function FavoriteButton({
  creatorId,
  initial = false,
  label = false,
}: {
  creatorId: string;
  initial?: boolean;
  label?: boolean;
}) {
  const [saved, setSaved] = useState(initial),
    [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      className={`favorite-button ${saved ? "saved" : ""} ${label ? "with-label" : ""}`}
      aria-label={saved ? "Remove favorite" : "Favorite creator"}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await api<{ favorited: boolean }>({
            action: "favorite",
            creatorId,
          });
          setSaved(r.favorited);
          toast(
            r.favorited
              ? "Added to your favorites."
              : "Removed from favorites.",
          );
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Heart size={18} fill={saved ? "currentColor" : "none"} />
      {label && (saved ? "Favorited" : "Favorite")}
    </button>
  );
}
export function CheckoutButton({
  kind,
  targetId,
  price,
  label,
  creatorName,
  onComplete,
  tipBounds,
  className = "button",
}: {
  kind: "SUBSCRIPTION" | "RENEWAL" | "PPV" | "MESSAGE" | "TIP" | "REQUEST";
  targetId: string;
  price: number;
  label?: string;
  creatorName?: string;
  onComplete?: () => void;
  tipBounds?: { min: number; max: number };
  className?: string;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [amount, setAmount] = useState(
      String(Math.max(price, tipBounds?.min || 0) / 100),
    ),
    [brief, setBrief] = useState(""),
    [fail, setFail] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const value = kind === "TIP" ? Math.round(Number(amount) * 100) : price;
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {kind === "TIP" ? <Gift size={16} /> : <LockKeyhole size={14} />}{" "}
        {label ||
          `${kind === "SUBSCRIPTION" ? "Join the inner circle" : "Unlock"} · ${money(price)}`}
        <ArrowUpRight size={16} />
      </button>
      {open && (
        <Modal
          title={
            kind === "TIP"
              ? "A thoughtful gesture."
              : kind === "REQUEST"
                ? "Make it personal."
                : kind === "SUBSCRIPTION"
                  ? `A little closer to ${creatorName || "your creator"}.`
                  : "An exclusive moment."
          }
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <p>
            {kind === "SUBSCRIPTION"
              ? "A 30-day membership with subscriber-only posts and a more personal connection. PPV posts and paid messages are sold separately."
              : kind === "REQUEST"
                ? "Describe a safe creative brief for a personalized fictional AI art study. Requests are reviewed by our studio."
                : "Unlock something made to inspire your imagination."}
          </p>
          {kind === "TIP" && (
            <label className="field">
              Tip amount (€)
              <input
                type="number"
                min={(tipBounds?.min || 1) / 100}
                max={tipBounds ? tipBounds.max / 100 : undefined}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          )}
          {kind === "REQUEST" && (
            <label className="field">
              Your creative brief
              <textarea
                minLength={10}
                maxLength={1000}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="An abstract portrait inspired by Mediterranean light…"
              />
            </label>
          )}
          <div className="checkout-summary">
            <span>
              {kind === "SUBSCRIPTION"
                ? "Monthly membership"
                : "One-time purchase"}
            </span>
            <strong>{money(value)}</strong>
          </div>
          <div className="demo-notice">
            <ShieldCheck size={18} />
            <span>
              Demo checkout. No card details. No real money is charged.
            </span>
          </div>
          <label className="check-row fine-print">
            <input
              type="checkbox"
              checked={fail}
              onChange={(e) => setFail(e.target.checked)}
            />
            Simulate a declined payment
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button full"
            disabled={
              busy ||
              !Number.isFinite(value) ||
              value <= 0 ||
              (kind === "REQUEST" && brief.trim().length < 10)
            }
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await api<{ status: string }>({
                  action: "checkout",
                  kind,
                  targetId,
                  idempotencyKey: crypto.randomUUID(),
                  ...(kind === "TIP" ? { amount: value } : {}),
                  ...(kind === "REQUEST" ? { brief } : {}),
                  simulateFailure: fail,
                });
                if (r.status !== "PAID")
                  throw new Error(
                    "The demo payment was declined. Your access has not changed.",
                  );
                setOpen(false);
                toast("Confirmed. Your private world just expanded.");
                router.refresh();
                onComplete?.();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner /> : "Confirm demo payment"}{" "}
            <ArrowUpRight size={16} />
          </button>
          <p className="fine-print centered">
            Access is verified on the server. Pricing includes demo tax
            placeholder.
          </p>
        </Modal>
      )}
    </>
  );
}
export function MessageButton({ creatorId }: { creatorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="button secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const c = await api<{ id: string }>({
            action: "conversation",
            creatorId,
          });
          router.push(`/app/messages?conversation=${c.id}`);
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner /> : <MessageCircle size={17} />} Start a conversation
    </button>
  );
}
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "CREATOR" | "POST" | "MESSAGE" | "USER";
  targetId: string;
}) {
  const [open, setOpen] = useState(false),
    [reasons, setReasons] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [detail, setDetail] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="text-button report-button"
        onClick={async () => {
          setOpen(true);
          try {
            const r = await fetch("/api/report-reasons");
            const list = (await r.json()) as string[];
            setReasons(list);
            setReason(list[0]);
          } catch {
            toast("Report categories unavailable.", true);
          }
        }}
      >
        <Flag size={13} />
        Report
      </button>
      {open && (
        <Modal
          title="Help keep this world safe."
          onClose={() => setOpen(false)}
        >
          <p>
            Reports are reviewed by our moderation team. Include only
            information relevant to the concern.
          </p>
          <label className="field">
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Details
            <textarea
              maxLength={2000}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Tell us what we should review."
            />
          </label>
          <button
            className="button full"
            disabled={busy || !reason}
            onClick={async () => {
              setBusy(true);
              try {
                await api({
                  action: "report",
                  targetType,
                  targetId,
                  reason,
                  detail,
                });
                toast(
                  "Report received. Thank you for helping keep VELORA safe.",
                );
                setOpen(false);
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner /> : "Submit report"}
          </button>
        </Modal>
      )}
    </>
  );
}
