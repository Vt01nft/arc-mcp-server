"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCircle } from "./CircleProvider";

type Notif = {
  chain_job_id: number;
  kind: string;
  message: string;
  created_at: string;
};

const SEEN_KEY = "arc_notif_seen_at";

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell() {
  const { status, address } = useCircle();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const v = Number(localStorage.getItem(SEEN_KEY) ?? 0);
    setSeenAt(Number.isFinite(v) ? v : 0);
  }, []);

  const load = useCallback(async () => {
    if (status !== "ready" || !address) {
      setItems([]);
      return;
    }
    try {
      const r = await fetch(
        `/api/notifications?address=${address}`,
        { cache: "no-store" }
      );
      const j = (await r.json()) as { notifications?: Notif[] };
      setItems(Array.isArray(j.notifications) ? j.notifications : []);
    } catch {
      /* transient; keep prior list */
    }
  }, [status, address]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (status !== "ready" || !address) return null;

  const unread = items.filter(
    (n) => new Date(n.created_at).getTime() > seenAt
  ).length;

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        const now = Date.now();
        localStorage.setItem(SEEN_KEY, String(now));
        setSeenAt(now);
      }
      return next;
    });
  }

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        className="mast-link"
        onClick={toggle}
        aria-label="Notifications"
        style={{
          background: "none",
          border: 0,
          cursor: "pointer",
          position: "relative",
          padding: 0,
          font: "inherit",
          color: "inherit",
        }}
      >
        Alerts
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -7,
              right: -12,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--accent)",
              color: "var(--paper)",
              fontSize: 10,
              lineHeight: "16px",
              textAlign: "center",
              fontWeight: 700,
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 26,
            right: 0,
            width: 320,
            maxHeight: 380,
            overflowY: "auto",
            background: "var(--paper)",
            border: "1px solid var(--ink)",
            zIndex: 50,
            boxShadow: "4px 4px 0 rgba(0,0,0,0.12)",
          }}
        >
          <div
            className="eyebrow accent"
            style={{ padding: "12px 14px", borderBottom: "1px solid var(--rule)" }}
          >
            Notifications
          </div>
          {items.length === 0 ? (
            <p style={{ padding: 14, fontSize: 13, color: "var(--ink-2)", margin: 0 }}>
              No notifications yet. Post a job and an agent will report back here.
            </p>
          ) : (
            items.map((n, i) => (
              <Link
                key={`${n.chain_job_id}-${i}`}
                href={`/jobs/${n.chain_job_id}`}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--rule)",
                  textDecoration: "none",
                  color: "var(--ink)",
                }}
              >
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{n.message}</div>
                <div
                  className="mono"
                  style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}
                >
                  {n.kind} · {ago(n.created_at)}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </span>
  );
}
