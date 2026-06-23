"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const FEATURES = [
  {
    icon: "🗂️",
    title: "Auto-organise your inbox",
    desc: "Choose categories like Finance, Newsletters, or Orders — Linear Mail labels and archives them across your entire history."
  },
  {
    icon: "✨",
    title: "AI that actually helps",
    desc: "Summarise any email in one click, get smart reply suggestions, or rewrite your drafts with the AI toolbar."
  },
  {
    icon: "✓✓",
    title: "Know when your email is read",
    desc: "Every email you send gets a read receipt. See double-ticks and exact open times right in your Sent folder."
  },
  {
    icon: "⏰",
    title: "Send later & snooze",
    desc: "Schedule emails for the right moment, or snooze anything to reappear tomorrow morning or next week."
  },
];

export default function OnboardingModal() {
  const [show, setShow] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem("lm_onboarded");
    if (!done) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem("lm_onboarded", "1");
    setShow(false);
  };

  const goToSettings = () => {
    localStorage.setItem("lm_onboarded", "1");
    setShow(false);
    const accountId = searchParams.get("account") || "";
    router.push(`/settings?account=${accountId}`);
  };

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px"
    }}>
      <div className="pop-in" style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--glass-border)",
        borderRadius: "20px",
        boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
        maxWidth: "520px", width: "100%",
        padding: "40px",
        display: "flex", flexDirection: "column", gap: "28px"
      }}>
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.4rem", marginBottom: "12px" }}>✉️</div>
          <h2 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, marginBottom: "8px" }}>
            Welcome to Linear Mail
          </h2>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "0.95rem" }}>
            A smarter Gmail client for people who get too many emails.
            Here's what makes it different:
          </p>
        </div>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
              <span style={{
                fontSize: "1.4rem", lineHeight: 1,
                width: "40px", height: "40px", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(99,102,241,0.1)", borderRadius: "10px"
              }}>
                {f.icon}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: "3px" }}>{f.title}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={goToSettings}
            className="btn-primary"
            style={{ width: "100%", padding: "14px", fontSize: "1rem" }}
          >
            Set up my categories →
          </button>
          <button
            onClick={dismiss}
            style={{
              width: "100%", padding: "12px",
              background: "transparent", border: "1px solid var(--glass-border)",
              borderRadius: "12px", color: "var(--text-secondary)",
              cursor: "pointer", fontSize: "0.9rem"
            }}
          >
            I'll explore on my own
          </button>
        </div>

        <p style={{ textAlign: "center", margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          By using Linear Mail you agree to our{" "}
          <a href="/privacy" target="_blank" style={{ color: "var(--accent)" }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
