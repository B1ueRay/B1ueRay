"use client";
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient();
export async function api<T = Record<string, unknown>>(
  body: Record<string, unknown>,
  endpoint = "/api/actions",
): Promise<T> {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Unable to complete this action.");
  return data;
}
export function toast(message: string, error = false) {
  window.dispatchEvent(
    new CustomEvent("velora-toast", { detail: { message, error } }),
  );
}
