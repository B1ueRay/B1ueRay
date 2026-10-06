"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, toast } from "@/lib/client";
import { Modal, Spinner } from "./ui";
type Choice = { id: string; name: string };
export function GenerationForm({ creators }: { creators: Choice[] }) {
  const [creatorId, setCreator] = useState(creators[0]?.id || ""),
    [type, setType] = useState("IMAGE"),
    [brief, setBrief] = useState(""),
    [negative, setNegative] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="admin-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api<{ status: string }>(
            {
              action: "generate",
              creatorId,
              type,
              brief,
              negativePrompt: negative,
            },
            "/api/admin",
          );
          toast(
            r.status === "REVIEW"
              ? "Generated. Asset held for staff review."
              : `Generation ${r.status.toLowerCase()}. Check the job details.`,
            r.status === "FAILED" || r.status === "REJECTED",
          );
          setBrief("");
          router.refresh();
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>A new creative chapter</h3>
      <div className="admin-form-grid">
        <label className="field">
          Creator
          <select
            value={creatorId}
            onChange={(e) => setCreator(e.target.value)}
          >
            {creators.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Media type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="IMAGE">Image · Safe mock artwork</option>
            <option value="VOICE">Voice · Neutral demo tone</option>
            <option value="VIDEO">Video · Provider adapter required</option>
          </select>
        </label>
        <label className="field wide">
          Creative brief
          <textarea
            required
            minLength={10}
            maxLength={2000}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="An elegant abstract editorial study with warm coastal colors. Fictional adult, fully clothed, safe for work."
          />
        </label>
        <label className="field wide">
          Negative prompt (optional)
          <input
            value={negative}
            maxLength={1000}
            onChange={(e) => setNegative(e.target.value)}
            placeholder="Recognizable real people, unsafe content…"
          />
        </label>
      </div>
      <div className="notice">
        Generation never publishes automatically. Safe mock outputs are held in
        REVIEW. Video is an explicit unsupported adapter and records a FAILED
        job.
      </div>
      <button className="button" disabled={busy || !creatorId}>
        {busy ? <Spinner /> : "Generate for review"}
      </button>
    </form>
  );
}
export function PostForm({
  creators,
  media,
  pricing,
}: {
  pricing: { min: number; max: number };
  creators: Choice[];
  media: { id: string; creatorId: string; title: string; type: string }[];
}) {
  const [creatorId, setCreator] = useState(creators[0]?.id || ""),
    [mediaId, setMedia] = useState(""),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [visibility, setVisibility] = useState("PUBLIC"),
    [price, setPrice] = useState(String(pricing.min / 100)),
    [publish, setPublish] = useState(false),
    [scheduled, setScheduled] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  const choices = media.filter((m) => m.creatorId === creatorId);
  return (
    <form
      className="admin-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api(
            {
              action: "createPost",
              creatorId,
              mediaId,
              title,
              body,
              visibility,
              price: visibility === "PPV" ? Math.round(Number(price) * 100) : 0,
              publish,
              ...(scheduled
                ? { scheduledAt: new Date(scheduled).toISOString() }
                : {}),
            },
            "/api/admin",
          );
          toast(publish ? "Post approved for publication." : "Draft saved.");
          setTitle("");
          setBody("");
          router.refresh();
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Publish a moment</h3>
      <div className="admin-form-grid">
        <label className="field">
          Creator
          <select
            value={creatorId}
            onChange={(e) => {
              setCreator(e.target.value);
              setMedia("");
            }}
          >
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Approved asset
          <select
            value={mediaId}
            required
            onChange={(e) => setMedia(e.target.value)}
          >
            <option value="">Choose reviewed media</option>
            {choices.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} · {m.type} · {m.id.slice(-6)}
              </option>
            ))}
          </select>
        </label>
        <label className="field wide">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={3}
            maxLength={150}
            required
          />
        </label>
        <label className="field wide">
          Post copy
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            minLength={10}
            maxLength={4000}
            required
          />
        </label>
        <label className="field">
          Visibility
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="PUBLIC">Public preview</option>
            <option value="SUBSCRIBER">Subscriber only</option>
            <option value="PPV">Pay per view</option>
          </select>
        </label>
        <label className="field">
          PPV price (€)
          <input
            type="number"
            min={pricing.min / 100}
            max={pricing.max / 100}
            step="0.01"
            disabled={visibility !== "PPV"}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label className="field">
          Scheduled date (local time, optional)
          <input
            type="datetime-local"
            value={scheduled}
            onChange={(e) => setScheduled(e.target.value)}
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
          />
          Approve and publish{scheduled ? " at scheduled time" : ""}
        </label>
      </div>
      <button className="button" disabled={busy || !mediaId}>
        {busy ? <Spinner /> : publish ? "Create approved post" : "Save draft"}
      </button>
    </form>
  );
}
export type EditableCreator = {
  id: string;
  name: string;
  bio: string;
  category: string;
  tags: string[];
  languages: string[];
  featured: boolean;
  plans: { price: number }[];
  settings: {
    chatAccess: string;
    paidMessagePrice: number;
    tipMin: number;
    tipMax: number;
    requestStartingPrice: number;
  } | null;
};
export function CreatorEditor({ creator: c }: { creator: EditableCreator }) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(c.name),
    [bio, setBio] = useState(c.bio),
    [price, setPrice] = useState(String((c.plans[0]?.price || 1499) / 100)),
    [paid, setPaid] = useState(
      String((c.settings?.paidMessagePrice || 1299) / 100),
    ),
    [request, setRequest] = useState(
      String((c.settings?.requestStartingPrice || 2999) / 100),
    ),
    [tipMin, setTipMin] = useState(String((c.settings?.tipMin || 100) / 100)),
    [tipMax, setTipMax] = useState(String((c.settings?.tipMax || 50000) / 100)),
    [chat, setChat] = useState(c.settings?.chatAccess || "FREE"),
    [featured, setFeatured] = useState(c.featured),
    [category, setCategory] = useState(c.category),
    [tags, setTags] = useState(c.tags.join(", ")),
    [languages, setLanguages] = useState(c.languages.join(", ")),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <>
      <button className="button secondary" onClick={() => setOpen(true)}>
        Manage creator
      </button>
      {open && (
        <Modal
          title={`Inside ${c.name}’s world`}
          onClose={() => setOpen(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(
                  {
                    action: "creator",
                    creatorId: c.id,
                    name,
                    bio,
                    category,
                    tags: tags
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                    languages: languages
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                    price: Math.round(Number(price) * 100),
                    tipMin: Math.round(Number(tipMin) * 100),
                    tipMax: Math.round(Number(tipMax) * 100),
                    featured,
                    chatAccess: chat,
                    paidMessagePrice: Math.round(Number(paid) * 100),
                    requestStartingPrice: Math.round(Number(request) * 100),
                  },
                  "/api/admin",
                );
                toast("Creator settings saved.");
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </label>
            <label className="field">
              Bio
              <textarea
                required
                minLength={10}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <label className="field">
              Category
              <input
                value={category}
                required
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
            <label className="field">
              Tags, separated by commas
              <input value={tags} onChange={(e) => setTags(e.target.value)} />
            </label>
            <label className="field">
              Languages, separated by commas
              <input
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
              />
            </label>
            <label className="field">
              Monthly subscription (€)
              <input
                type="number"
                required
                min="1"
                step=".01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label className="field">
              Paid message price (€)
              <input
                type="number"
                required
                min="0.01"
                max="1000"
                step=".01"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </label>
            <label className="field">
              Custom request starting price (€)
              <input
                type="number"
                required
                min="1"
                step=".01"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
              />
            </label>
            <label className="field">
              Tip minimum (€)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={tipMin}
                onChange={(e) => setTipMin(e.target.value)}
              />
            </label>
            <label className="field">
              Tip maximum (€)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={tipMax}
                onChange={(e) => setTipMax(e.target.value)}
              />
            </label>
            <label className="field">
              Chat access
              <select value={chat} onChange={(e) => setChat(e.target.value)}>
                <option value="FREE">Free messages</option>
                <option value="SUBSCRIBER">Subscribers only</option>
              </select>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
              />
              Featured creator
            </label>
            <button className="button full" disabled={busy}>
              {busy ? <Spinner /> : "Save creator settings"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function DecisionForm({
  type,
  id,
  current,
  media = [],
}: {
  type: "userStatus" | "content" | "report" | "request";
  id: string;
  current: string;
  media?: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(
      type === "report"
        ? "UNDER_REVIEW"
        : type === "request"
          ? "ACCEPTED"
          : current,
    ),
    [decision, setDecision] = useState("NONE"),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const [asset, setAsset] = useState("");
  const router = useRouter();
  const options =
    type === "userStatus"
      ? ["ACTIVE", "SUSPENDED", "BANNED"]
      : type === "content"
        ? ["APPROVED", "HIDDEN", "REMOVED"]
        : type === "report"
          ? ["UNDER_REVIEW", "ACTIONED", "DISMISSED"]
          : ["ACCEPTED", "COMPLETED", "REJECTED"];
  return (
    <>
      <button className="button secondary" onClick={() => setOpen(true)}>
        {type === "report"
          ? "Review report"
          : type === "userStatus"
            ? "Manage account"
            : type === "request"
              ? "Update request"
              : "Moderate"}
      </button>
      {open && (
        <Modal title="A considered decision." onClose={() => setOpen(false)}>
          <p>
            Every sensitive action is recorded in the audit log. Include the
            reason for your decision.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const targetKey =
                  type === "userStatus"
                    ? "userId"
                    : type === "content"
                      ? "postId"
                      : type === "report"
                        ? "reportId"
                        : "requestId";
                await api(
                  {
                    action: type,
                    [targetKey]: id,
                    [type === "content" ? "state" : "status"]: value,
                    reason,
                    ...(type === "report" ? { decision } : {}),
                    ...(type === "request" && value === "COMPLETED"
                      ? { fulfilledMediaId: asset }
                      : {}),
                  },
                  "/api/admin",
                );
                toast("Decision saved and audited.");
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Status
              <select value={value} onChange={(e) => setValue(e.target.value)}>
                {options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            {type === "report" && (
              <label className="field">
                Enforcement
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                >
                  {["NONE", "HIDE", "REMOVE", "SUSPEND", "BAN"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}
            {type === "request" && value === "COMPLETED" && (
              <label className="field">
                Reviewed delivery asset
                <select
                  required
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                >
                  <option value="">Choose approved media</option>
                  {media.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} · {m.id.slice(-6)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              Reason
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button className="button full" disabled={busy}>
              {busy ? <Spinner /> : "Save decision"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function SiteConfigForm({
  reasons,
  min,
  max,
}: {
  reasons: string[];
  min: number;
  max: number;
}) {
  const [text, setText] = useState(reasons.join("\n")),
    [low, setLow] = useState(String(min / 100)),
    [high, setHigh] = useState(String(max / 100)),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="admin-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api(
            {
              action: "config",
              reportReasons: text
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
              ppvMin: Math.round(Number(low) * 100),
              ppvMax: Math.round(Number(high) * 100),
            },
            "/api/admin",
          );
          toast("Site configuration saved.");
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Policy & pricing configuration</h3>
      <label className="field">
        Report categories (one per line)
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
      </label>
      <div className="admin-form-grid">
        <label className="field">
          PPV minimum (€)
          <input
            type="number"
            required
            min="1"
            step=".01"
            value={low}
            onChange={(e) => setLow(e.target.value)}
          />
        </label>
        <label className="field">
          PPV maximum (€)
          <input
            type="number"
            required
            step=".01"
            value={high}
            onChange={(e) => setHigh(e.target.value)}
          />
        </label>
      </div>
      <button className="button" disabled={busy}>
        {busy ? <Spinner /> : "Save configuration"}
      </button>
      <p className="fine-print" style={{ marginTop: 20 }}>
        Jurisdiction restrictions and provider credentials are environment
        settings. Creator prices, categories, tags, and featured placement are
        managed on the Creators page.
      </p>
    </form>
  );
}
export function PaidMessageForm({
  conversations,
  media,
}: {
  conversations: { id: string; name: string; creatorId: string }[];
  media: { id: string; creatorId: string; title: string }[];
}) {
  const [conversation, setConversation] = useState(conversations[0]?.id || ""),
    [preview, setPreview] = useState("A creative note, made just for you."),
    [body, setBody] = useState(""),
    [asset, setAsset] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  const c = conversations.find((v) => v.id === conversation);
  return (
    <form
      className="admin-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api(
            {
              action: "paidMessage",
              conversationId: conversation,
              preview,
              body,
              ...(asset ? { mediaId: asset } : {}),
            },
            "/api/admin",
          );
          toast("Private paid message delivered.");
          setBody("");
          router.refresh();
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Send a reviewed private message</h3>
      <label className="field">
        Conversation
        <select
          value={conversation}
          onChange={(e) => {
            setConversation(e.target.value);
            setAsset("");
          }}
        >
          {conversations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Public preview
        <input
          required
          maxLength={200}
          value={preview}
          onChange={(e) => setPreview(e.target.value)}
        />
      </label>
      <label className="field">
        Locked message body
        <textarea
          minLength={10}
          maxLength={2000}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <label className="field">
        Approved attachment (optional)
        <select value={asset} onChange={(e) => setAsset(e.target.value)}>
          <option value="">No attachment</option>
          {media
            .filter((m) => m.creatorId === c?.creatorId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} · {m.id.slice(-6)}
              </option>
            ))}
        </select>
      </label>
      <p className="fine-print">
        Pricing comes from the creator’s paid-message setting. Body and
        attachment are withheld until verified payment.
      </p>
      <button
        className="button"
        style={{ marginTop: 20 }}
        disabled={busy || !conversation}
      >
        {busy ? <Spinner /> : "Send locked message"}
      </button>
    </form>
  );
}
