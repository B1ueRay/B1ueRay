"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ShieldCheck, Mail } from "lucide-react";
import { authClient, api } from "@/lib/client";
import { Spinner } from "./ui";
export function AuthForm({
  mode,
  token,
}: {
  mode: "login" | "signup" | "forgot" | "reset";
  token?: string;
}) {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const router = useRouter();
  return (
    <div className="auth-card">
      <div className="eyebrow">YOUR PRIVATE WORLD</div>
      <h1>
        {mode === "signup"
          ? "A new connection starts here."
          : mode === "forgot"
            ? "Find your way back."
            : mode === "reset"
              ? "A fresh start."
              : "Welcome back."}
      </h1>
      <p>
        {mode === "signup"
          ? "Discover extraordinary fictional AI creators. Your curiosity belongs here."
          : mode === "forgot"
            ? "Enter your email. If an account exists, a reset link will be sent."
            : mode === "reset"
              ? "Choose a strong, unique password."
              : "Your inner circle is waiting."}
      </p>
      {done ? (
        <div className="empty-state">
          <Mail size={28} />
          <h3>Check your inbox.</h3>
          <p>
            If an eligible account exists, you’ll receive a secure reset link.
            In demo mode, delivery is stored in the local development inbox.
          </p>
          <Link href="/login" className="button">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (mode === "signup") {
                const result = await authClient.signUp.email({
                  name,
                  email,
                  password,
                });
                if (result.error) throw new Error(result.error.message);
                await api({ confirmed: true, acceptTerms: true }, "/api/age");
                router.push("/app/feed");
                router.refresh();
              } else if (mode === "login") {
                const result = await authClient.signIn.email({
                  email,
                  password,
                });
                if (result.error) throw new Error(result.error.message);
                router.push("/app/feed");
                router.refresh();
              } else if (mode === "forgot") {
                const result = await authClient.requestPasswordReset({
                  email,
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (result.error) throw new Error(result.error.message);
                setDone(true);
              } else {
                const result = await authClient.resetPassword({
                  newPassword: password,
                  token: token || "",
                });
                if (result.error) throw new Error(result.error.message);
                router.push("/login");
              }
            } catch (e) {
              setError((e as Error).message || "Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "signup" && (
            <label className="field">
              Your name
              <input
                autoComplete="name"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
              />
            </label>
          )}
          {mode !== "reset" && (
            <label className="field">
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label className="field">
              Password
              <input
                type="password"
                required
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "login" ? "Your password" : "At least 12 characters"
                }
              />
            </label>
          )}
          {mode === "login" && (
            <Link className="forgot-link" href="/forgot-password">
              Forgot password?
            </Link>
          )}
          {mode === "signup" && (
            <label className="check-row">
              <input
                type="checkbox"
                required
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              I am 18+ and accept the <Link href="/legal/terms">Terms</Link>,{" "}
              <Link href="/legal/privacy">Privacy Notice</Link> and{" "}
              <Link href="/legal/content-policy">Content Policy</Link>.
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button full"
            disabled={busy || (mode === "signup" && !accepted)}
          >
            {busy ? (
              <Spinner />
            ) : mode === "signup" ? (
              "Create your account"
            ) : mode === "forgot" ? (
              "Send reset link"
            ) : mode === "reset" ? (
              "Update password"
            ) : (
              "Sign in"
            )}
            <ArrowUpRight size={17} />
          </button>
        </form>
      )}
      {(mode === "signup" || mode === "login") && (
        <p className="auth-switch">
          {mode === "signup"
            ? "Already part of the inner circle?"
            : "New to this world?"}{" "}
          <Link href={mode === "signup" ? "/login" : "/signup"}>
            {mode === "signup" ? "Sign in" : "Create an account"}
          </Link>
        </p>
      )}
      <div className="privacy-small">
        <ShieldCheck size={16} />
        Private by design. Fictional AI, always disclosed.
      </div>
    </div>
  );
}
