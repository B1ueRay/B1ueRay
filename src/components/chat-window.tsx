"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Gift } from "lucide-react";
import { api, toast } from "@/lib/client";
import { money } from "@/lib/brand";
import { CheckoutButton, ReportButton } from "./commerce";
import { ActionButton } from "./member-actions";
import { Spinner, AIBadge } from "./ui";
export type ConversationView = {
  id: string;
  creator: {
    id: string;
    name: string;
    avatar: string;
    aiDisclosure: string;
    settings?: { tipMin: number; tipMax: number } | null;
  };
  messages: {
    id: string;
    sender: string;
    type: string;
    body: string;
    price: number;
    unlocked: boolean;
    createdAt: string | Date;
    attachments: { url: string; type: string }[];
  }[];
};
export function ChatWindow({ initial }: { initial: ConversationView }) {
  const [chat, setChat] = useState(initial),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setChat(initial);
  }, [initial]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages.length]);
  async function reload() {
    const r = await fetch(`/api/conversations/${chat.id}`);
    const data = await r.json();
    if (r.ok) setChat(data);
    else toast(data.error, true);
  }
  return (
    <div className="chat-window">
      <header className="chat-header">
        <div>
          <h3>{chat.creator.name}</h3>
          <p>
            <AIBadge /> Fictional adult · Private conversation
          </p>
        </div>
        <div className="chat-controls">
          <CheckoutButton
            kind="TIP"
            tipBounds={
              chat.creator.settings
                ? {
                    min: chat.creator.settings.tipMin,
                    max: chat.creator.settings.tipMax,
                  }
                : undefined
            }
            targetId={chat.creator.id}
            price={500}
            label="Tip"
            className="button secondary"
          />
          <ActionButton
            label="Delete"
            body={{ action: "deleteConversation", conversationId: chat.id }}
            confirm="Delete this conversation and its saved memory? Messages will be permanently removed; payment records remain for accounting."
            danger
          />
        </div>
      </header>
      <div className="chat-messages">
        <div className="chat-disclosure">
          <Sparkles
            size={12}
            style={{ display: "inline", verticalAlign: "middle" }}
          />{" "}
          You’re chatting with a fictional AI persona. This demo uses simulated
          replies.
        </div>
        {chat.messages.length === 0 && (
          <div className="message-bubble">
            <p>
              Welcome to my little world. Tell me what you’re curious about
              today.
            </p>
            <small>AI · Welcome message</small>
          </div>
        )}
        {chat.messages.map((m) => (
          <div
            key={m.id}
            className={`message-bubble ${m.sender === "USER" ? "user" : ""} ${!m.unlocked ? "locked" : ""} ${m.sender === "SYSTEM" ? "system" : ""}`}
          >
            <p>
              {m.type === "TIP" && (
                <Gift size={14} style={{ display: "inline" }} />
              )}
              {m.body}
              {m.type === "TIP" && ` · ${money(m.price)}`}
            </p>
            {!m.unlocked && (
              <CheckoutButton
                kind="MESSAGE"
                targetId={m.id}
                price={m.price}
                label={`Unlock private note · ${money(m.price)}`}
                onComplete={reload}
              />
            )}{" "}
            {m.attachments.map((a) =>
              a.type === "VOICE" ? (
                <audio
                  key={a.url}
                  className="message-attachment"
                  src={a.url}
                  controls
                />
              ) : (
                <img
                  className="message-attachment"
                  key={a.url}
                  src={a.url}
                  alt="Safe AI creative artwork"
                />
              ),
            )}
            <small>
              {m.sender === "CREATOR" ? "AI creator · " : ""}
              {new Date(m.createdAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
            {m.sender === "CREATOR" && (
              <ReportButton targetType="MESSAGE" targetId={m.id} />
            )}
          </div>
        ))}
        {busy && (
          <div className="message-bubble">
            <Spinner />
            <small>Your creator is composing a thought…</small>
          </div>
        )}
        <div ref={end} />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form
        className="chat-input"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          setError("");
          try {
            const result = await api<ConversationView>({
              action: "message",
              conversationId: chat.id,
              text: text.trim(),
            });
            setChat(result);
            setText("");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Your message"
          maxLength={2000}
          rows={1}
          placeholder="A thought. A question. A little hello…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          className="button"
          type="submit"
          disabled={busy || !text.trim()}
          aria-label="Send message"
        >
          {busy ? <Spinner /> : <Send size={17} />}
        </button>
      </form>
      <div className="chat-input-hint">
        Private & moderated · Safe demo · Your memory preferences are in
        Settings
      </div>
    </div>
  );
}
