"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, authClient, toast } from "@/lib/client";
import { Modal, Spinner } from "./ui";
export function ActionButton({
  label,
  body,
  confirm,
  danger = false,
  endpoint = "/api/actions",
}: {
  label: string;
  body: Record<string, unknown>;
  confirm?: string;
  danger?: boolean;
  endpoint?: string;
}) {
  const [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false);
  const router = useRouter();
  async function run() {
    setBusy(true);
    try {
      await api(body, endpoint);
      toast("Your change has been saved.");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className={`button secondary ${danger ? "danger-button" : ""}`}
        disabled={busy}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {busy ? <Spinner /> : label}
      </button>
      {open && (
        <Modal title="One more moment." onClose={() => setOpen(false)}>
          <p>{confirm}</p>
          <button
            className={`button full ${danger ? "danger-button" : ""}`}
            disabled={busy}
            onClick={run}
          >
            {busy ? <Spinner /> : label}
          </button>
        </Modal>
      )}
    </>
  );
}
export function SettingsForm({
  settings,
}: {
  settings: {
    memoryEnabled: boolean;
    analyticsConsent: boolean;
    emailNotifications: boolean;
  };
}) {
  const [value, setValue] = useState(settings),
    [busy, setBusy] = useState(false);
  return (
    <section className="settings-card">
      <h3>Your privacy, your preferences.</h3>
      <p>
        Choose what your fictional AI creators remember. Optional analytics
        never includes conversation text.
      </p>
      {[
        [
          "memoryEnabled",
          "Conversation memory",
          "Remember a preferred name and conversation preferences. Turning this off clears saved memory.",
        ],
        [
          "analyticsConsent",
          "Optional product analytics",
          "Share minimal first-party usage events. No chat text is collected.",
        ],
        [
          "emailNotifications",
          "Future email notifications",
          "Preference stored; external email delivery is not connected in this demo.",
        ],
      ].map(([key, title, desc]) => (
        <label className="setting-row" key={key}>
          <div>
            {title}
            <small>{desc}</small>
          </div>
          <input
            type="checkbox"
            checked={value[key as keyof typeof value]}
            onChange={(e) => setValue({ ...value, [key]: e.target.checked })}
          />
        </label>
      ))}
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api({ action: "settings", ...value });
            toast("Privacy preferences saved.");
          } catch (e) {
            toast((e as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : "Save preferences"}
      </button>
    </section>
  );
}
export function BlockForm() {
  const [id, setId] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="blocked-input"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api({ action: "block", blockedUserId: id });
          toast("Account blocked.");
          setId("");
          router.refresh();
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        className="standard"
        aria-label="Account ID to block"
        required
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="Account ID to block"
      />
      <button className="button secondary" disabled={busy}>
        Block account
      </button>
    </form>
  );
}
export function PasswordForm() {
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="settings-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await authClient.changePassword({
            currentPassword: current,
            newPassword: next,
            revokeOtherSessions: true,
          });
          if (r.error) throw new Error(r.error.message);
          toast("Password changed. Other sessions have been revoked.");
          setCurrent("");
          setNext("");
        } catch (e) {
          toast((e as Error).message, true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Account security</h3>
      <label className="field">
        Current password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </label>
      <label className="field">
        New password
        <input
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </label>
      <button className="button secondary" disabled={busy}>
        Update password
      </button>
    </form>
  );
}
