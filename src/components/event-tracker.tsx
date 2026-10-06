"use client";
import { useEffect } from "react";
import { api } from "@/lib/client";
export function EventTracker({
  name,
  creatorId,
}: {
  name: "creator_view" | "landing_view";
  creatorId?: string;
}) {
  useEffect(() => {
    void api({ action: "event", name, creatorId }).catch(() => {});
  }, [name, creatorId]);
  return null;
}
