"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

const PRESETS = [
  {
    emoji: "💰", name: "Finance & Banking",
    labelName: "Organizer/Finance",
    query: "(bank OR statement OR payment OR invoice OR receipt OR bill OR transaction OR \"wire transfer\" OR \"direct deposit\" OR NEFT OR IMPS OR UPI) -in:trash -in:draft",
    archive: false, markRead: false,
    desc: "Bank statements, invoices, payment receipts, bills"
  },
  {
    emoji: "📧", name: "Newsletters",
    labelName: "Organizer/Newsletters",
    query: "(newsletter OR digest OR unsubscribe OR \"email preferences\" OR \"mailing list\" OR \"view in browser\" OR \"email frequency\") -in:trash -in:draft",
    archive: true, markRead: true,
    desc: "Digests, subscriptions — auto-archived & marked read"
  },
  {
    emoji: "🔔", name: "Notifications",
    labelName: "Organizer/Notifications",
    query: "(notification OR alert OR noreply OR \"no-reply\" OR \"do not reply\" OR automated OR \"account activity\" OR \"security alert\") -in:trash -in:draft",
    archive: false, markRead: false,
    desc: "System alerts, account activity, security notices"
  },
  {
    emoji: "📦", name: "Orders & Shipping",
    labelName: "Organizer/Orders",
    query: "(\"your order\" OR \"order confirmation\" OR \"order #\" OR shipping OR \"tracking number\" OR delivery OR dispatched OR \"out for delivery\" OR \"has been shipped\") -in:trash -in:draft",
    archive: false, markRead: false,
    desc: "Order confirmations, shipping updates, delivery tracking"
  },
  {
    emoji: "🌐", name: "Social Media",
    labelName: "Organizer/Social",
    query: "(linkedin OR twitter OR facebook OR instagram OR youtube OR github OR \"someone you may know\" OR \"new follower\" OR \"reacted to\" OR \"mentioned you\") -in:trash -in:draft",
    archive: true, markRead: true,
    desc: "Platform notifications — auto-archived & marked read"
  },
  {
    emoji: "✈️", name: "Travel",
    labelName: "Organizer/Travel",
    query: "(booking OR reservation OR flight OR hotel OR itinerary OR \"check-in\" OR airbnb OR \"boarding pass\" OR \"your trip\" OR \"e-ticket\" OR makemytrip OR cleartrip OR goibibo) -in:trash -in:draft",
    archive: false, markRead: false,
    desc: "Flights, hotels, bookings, itineraries, e-tickets"
  },
  {
    emoji: "🎯", name: "Promotions",
    labelName: "Organizer/Promotions",
    query: "(\"% off\" OR discount OR coupon OR promo OR \"flash sale\" OR deal OR \"limited time\" OR \"exclusive offer\" OR \"special offer\" OR \"buy now\") -in:trash -in:draft",
    archive: true, markRead: true,
    desc: "Sales, coupons, offers — auto-archived & marked read"
  },
  {
    emoji: "💼", name: "Meetings & Work",
    labelName: "Organizer/Meetings",
    query: "(\"calendar invite\" OR \"meeting request\" OR agenda OR \"you've been invited\" OR conference OR webinar OR \"Google Meet\" OR zoom OR \"join the meeting\") -in:trash -in:draft",
    archive: false, markRead: false,
    desc: "Meeting invites, calendar events, conferences"
  },
  {
    emoji: "🧾", name: "GST & Tax",
    labelName: "Organizer/Tax",
    query: "(GST OR \"tax invoice\" OR TDS OR ITR OR \"income tax\" OR \"e-way bill\" OR GSTIN OR \"tax return\" OR \"advance tax\") -in:trash -in:draft",
    archive: false, markRead: false,
    desc: "GST invoices, TDS, ITR, tax notices"
  },
  {
    emoji: "🛒", name: "E-Commerce",
    labelName: "Organizer/Shopping",
    query: "(amazon OR flipkart OR myntra OR meesho OR snapdeal OR ajio OR nykaa OR swiggy OR zomato OR zepto OR blinkit) -in:trash -in:draft",
    archive: false, markRead: false,
    desc: "Amazon, Flipkart, Myntra, Swiggy and other platforms"
  },
];

const Toggle = ({ on, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    style={{
      width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
      background: on ? 'var(--accent)' : 'var(--glass-border)',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0
    }}
  >
    <span style={{
      position: 'absolute', top: '3px', width: '18px', height: '18px',
      borderRadius: '50%', background: '#fff',
      left: on ? '23px' : '3px', transition: 'left 0.2s'
    }} />
  </button>
);

export default function SettingsButtons() {
  const searchParams = useSearchParams();
  const activeAccountId = searchParams.get("account") || "";

  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(true);

  // Audit progress
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditProgress, setAuditProgress] = useState(null);
  const [auditDone, setAuditDone] = useState(false);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditError, setAuditError] = useState(null);

  // Custom rule form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customKeywords, setCustomKeywords] = useState("");
  const [customHasAttachment, setCustomHasAttachment] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customArchive, setCustomArchive] = useState(false);
  const [customMarkRead, setCustomMarkRead] = useState(false);
  const [showAdvancedQuery, setShowAdvancedQuery] = useState(false);
  const [customRawQuery, setCustomRawQuery] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);

  const buildCustomQuery = () => {
    if (showAdvancedQuery && customRawQuery) return customRawQuery;
    const parts = [];
    if (customFrom) parts.push(`from:${customFrom}`);
    if (customTo) parts.push(`to:${customTo}`);
    if (customSubject) parts.push(`subject:"${customSubject}"`);
    if (customKeywords) parts.push(customKeywords);
    if (customHasAttachment) parts.push("has:attachment");
    parts.push("-in:trash -in:draft");
    return parts.join(" ");
  };

  // Signature
  const [signatureStatus, setSignatureStatus] = useState("Save");
  const signatureEditor = useEditor({
    extensions: [StarterKit, Underline],
    editorProps: { attributes: { class: 'lm-editor', style: 'min-height:100px;' } },
  });
  useEffect(() => {
    fetch("/api/user/signature").then(r => r.json()).then(d => {
      if (d.signature && signatureEditor) {
        const isHTML = /<[a-z][\s\S]*>/i.test(d.signature);
        signatureEditor.commands.setContent(isHTML ? d.signature : d.signature.replace(/\n/g, '<br>'), false);
      }
    }).catch(console.error);
  }, [signatureEditor]);

  // Alias
  const [aliasName, setAliasName] = useState("");
  const [aliasEmail, setAliasEmail] = useState("");
  const [aliasStatus, setAliasStatus] = useState("Add Alias");

  async function fetchRules() {
    setLoadingRules(true);
    try {
      const res = await fetch("/api/gmail/rules");
      const data = await res.json();
      setRules(data.rules || []);
    } catch (e) { console.error(e); }
    finally { setLoadingRules(false); }
  }

  useEffect(() => {
    const timerId = setTimeout(() => { fetchRules(); }, 0);
    return () => clearTimeout(timerId);
  }, []);

  const isPresetActive = (preset) =>
    rules.some(r => r.labelName === preset.labelName && r.enabled);

  const togglePreset = async (preset) => {
    const existing = rules.find(r => r.labelName === preset.labelName);
    if (existing) {
      const res = await fetch("/api/gmail/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existing.id, enabled: !existing.enabled })
      });
      const data = await res.json();
      setRules(prev => prev.map(r => r.id === existing.id ? data.rule : r));
    } else {
      const res = await fetch("/api/gmail/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${preset.emoji} ${preset.name}`,
          query: preset.query,
          labelName: preset.labelName,
          archive: preset.archive,
          markRead: preset.markRead
        })
      });
      const data = await res.json();
      setRules(prev => [...prev, data.rule]);
    }
  };

  const deleteRule = async (id) => {
    await fetch("/api/gmail/rules", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const addCustomRule = async (e) => {
    e.preventDefault();
    const query = buildCustomQuery();
    if (!query.replace("-in:trash -in:draft", "").trim()) {
      alert("Add at least one condition (From, To, Subject, or Keywords).");
      return;
    }
    setSavingCustom(true);
    try {
      const res = await fetch("/api/gmail/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customName, query, labelName: customLabel, archive: customArchive, markRead: customMarkRead })
      });
      const data = await res.json();
      setRules(prev => [...prev, data.rule]);
      setCustomName(""); setCustomFrom(""); setCustomTo(""); setCustomSubject("");
      setCustomKeywords(""); setCustomHasAttachment(false); setCustomLabel("");
      setCustomArchive(false); setCustomMarkRead(false); setCustomRawQuery("");
      setShowCustomForm(false);
    } catch (e) { console.error(e); }
    finally { setSavingCustom(false); }
  };

  const runAudit = async () => {
    const enabled = rules.filter(r => r.enabled);
    if (enabled.length === 0) {
      alert("Turn on at least one rule first.");
      return;
    }
    setAuditRunning(true);
    setAuditDone(false);
    setAuditError(null);
    setAuditTotal(0);
    let cursor = null;
    let total = 0;
    try {
      while (true) {
        const res = await fetch("/api/gmail/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: activeAccountId, cursor })
        });
        if (!res.ok) throw new Error("Chunk failed");
        const data = await res.json();
        total += data.processed || 0;
        setAuditTotal(total);
        if (data.done) break;
        setAuditProgress({
          ruleName: data.ruleName,
          current: data.currentRuleIndex,
          total: data.totalRules
        });
        cursor = data.cursor;
      }
      setAuditDone(true);
    } catch (e) {
      console.error(e);
      setAuditError("Something went wrong. Try again.");
    } finally {
      setAuditRunning(false);
      setAuditProgress(null);
    }
  };

  const handleSaveSignature = async (e) => {
    e.preventDefault();
    setSignatureStatus("Saving…");
    try {
      const signature = signatureEditor?.getHTML() || '';
      await fetch("/api/user/signature", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature })
      });
      setSignatureStatus("Saved ✅");
      setTimeout(() => setSignatureStatus("Save"), 3000);
    } catch {
      setSignatureStatus("Error ❌");
      setTimeout(() => setSignatureStatus("Save"), 3000);
    }
  };

  const handleAddAlias = async (e) => {
    e.preventDefault();
    setAliasStatus("Adding…");
    try {
      const res = await fetch("/api/gmail/alias", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: aliasName, email: aliasEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setAliasStatus("Added — check your email to confirm ✅");
      setAliasName(""); setAliasEmail("");
      setTimeout(() => setAliasStatus("Add Alias"), 5000);
    } catch (e) {
      setAliasStatus(`Error: ${e.message}`);
      setTimeout(() => setAliasStatus("Add Alias"), 4000);
    }
  };

  const enabledCount = rules.filter(r => r.enabled).length;
  const customRules = rules.filter(r => !PRESETS.some(p => p.labelName === r.labelName));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '860px' }}>

      {/* ── Section 1: Preset Categories ── */}
      <section className="glass-panel" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>Organize Categories</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
          Toggle categories on. When you run the audit, Linear Mail labels every matching email in your inbox history and can auto-archive the noisy ones.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {PRESETS.map(preset => {
            const active = isPresetActive(preset);
            return (
              <div key={preset.labelName} style={{
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                padding: '16px', borderRadius: '12px',
                background: active ? 'rgba(99,102,241,0.08)' : 'var(--glass-bg)',
                border: `1px solid ${active ? 'rgba(99,102,241,0.35)' : 'var(--glass-border)'}`,
                transition: 'all 0.2s'
              }}>
                <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{preset.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>{preset.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: '1.4' }}>{preset.desc}</div>
                  {active && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {preset.archive && <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', borderRadius: '4px', padding: '2px 7px' }}>Auto-archive</span>}
                      {preset.markRead && <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', borderRadius: '4px', padding: '2px 7px' }}>Mark read</span>}
                    </div>
                  )}
                </div>
                <Toggle on={active} onChange={() => togglePreset(preset)} />
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 2: Custom Rules ── */}
      <section className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>Custom Rules</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Any Gmail search query — apply a label, archive, or mark read.</p>
          </div>
          <button
            onClick={() => setShowCustomForm(v => !v)}
            className="btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
          >
            + Add Rule
          </button>
        </div>

        {showCustomForm && (
          <form onSubmit={addCustomRule} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Rule name *</label>
                <input value={customName} onChange={e => setCustomName(e.target.value)} required placeholder="e.g. Client Emails" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Label to apply *</label>
                <input value={customLabel} onChange={e => setCustomLabel(e.target.value)} required placeholder="e.g. Clients/Important" style={inputStyle} />
              </div>
            </div>

            {!showAdvancedQuery ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>From contains</label>
                    <input value={customFrom} onChange={e => setCustomFrom(e.target.value)} placeholder="e.g. newsletter@company.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>To contains</label>
                    <input value={customTo} onChange={e => setCustomTo(e.target.value)} placeholder="e.g. me@mycompany.com" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Subject contains</label>
                  <input value={customSubject} onChange={e => setCustomSubject(e.target.value)} placeholder="e.g. invoice" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Keywords (any of these words appear anywhere)</label>
                  <input value={customKeywords} onChange={e => setCustomKeywords(e.target.value)} placeholder="e.g. refund OR cancellation OR dispute" style={inputStyle} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={customHasAttachment} onChange={e => setCustomHasAttachment(e.target.checked)} />
                  Has attachment
                </label>
                {(customFrom || customTo || customSubject || customKeywords || customHasAttachment) && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '8px 12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    Query: {buildCustomQuery()}
                  </div>
                )}
              </>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Raw Gmail query — <a href="https://support.google.com/mail/answer/7190" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>syntax guide ↗</a>
                </label>
                <input value={customRawQuery} onChange={e => setCustomRawQuery(e.target.value)} placeholder='from:client@company.com OR subject:"project update"' style={inputStyle} />
              </div>
            )}

            <button type="button" onClick={() => setShowAdvancedQuery(v => !v)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.82rem', cursor: 'pointer', padding: 0 }}>
              {showAdvancedQuery ? '← Use condition builder' : 'Advanced: write raw query →'}
            </button>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <Toggle on={customArchive} onChange={() => setCustomArchive(v => !v)} />
                Archive (remove from inbox)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>
                <Toggle on={customMarkRead} onChange={() => setCustomMarkRead(v => !v)} />
                Mark as read
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={savingCustom} className="btn-primary" style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
                {savingCustom ? "Saving…" : "Save Rule"}
              </button>
              <button type="button" onClick={() => setShowCustomForm(false)} style={{ padding: '8px 20px', fontSize: '0.9rem', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {loadingRules ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading…</div>
        ) : customRules.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '16px 0' }}>No custom rules yet. Add one above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {customRules.map(rule => (
              <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: rule.enabled ? 'rgba(99,102,241,0.06)' : 'var(--glass-bg)', border: `1px solid ${rule.enabled ? 'rgba(99,102,241,0.2)' : 'var(--glass-border)'}` }}>
                <Toggle on={rule.enabled} onChange={async () => {
                  const res = await fetch("/api/gmail/rules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }) });
                  const data = await res.json();
                  setRules(prev => prev.map(r => r.id === rule.id ? data.rule : r));
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rule.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.query}</div>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--glass-border)', borderRadius: '4px', padding: '2px 8px', whiteSpace: 'nowrap' }}>{rule.labelName}</span>
                {rule.archive && <span style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>archive</span>}
                {rule.markRead && <span style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>mark read</span>}
                <button onClick={() => deleteRule(rule.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', flexShrink: 0 }} title="Delete rule">✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 3: Run Audit ── */}
      <section className="glass-panel" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>Run Retroactive Audit</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '24px' }}>
          Scans your <strong>entire inbox history</strong> and applies all enabled rules. Processes 200 emails per batch — safe on any inbox size, no timeouts.
          Currently <strong style={{ color: 'var(--text-primary)' }}>{enabledCount} rule{enabledCount !== 1 ? 's' : ''}</strong> enabled.
        </p>

        {auditRunning && auditProgress && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Applying <strong style={{ color: 'var(--text-primary)' }}>{auditProgress.ruleName}</strong>…</span>
              <span style={{ color: 'var(--text-secondary)' }}>Rule {auditProgress.current} / {auditProgress.total}</span>
            </div>
            <div style={{ height: '6px', borderRadius: '3px', background: 'var(--glass-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '3px', background: 'var(--accent)', width: `${Math.round((auditProgress.current / auditProgress.total) * 100)}%`, transition: 'width 0.4s' }} />
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{auditTotal.toLocaleString()} emails processed so far…</div>
          </div>
        )}

        {auditDone && (
          <div style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '0.95rem' }}>
            ✅ Audit complete — <strong>{auditTotal.toLocaleString()}</strong> email{auditTotal !== 1 ? 's' : ''} organised across {enabledCount} rule{enabledCount !== 1 ? 's' : ''}.
          </div>
        )}

        {auditError && (
          <div style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.9rem', color: '#ef4444' }}>
            ❌ {auditError}
          </div>
        )}

        <button
          onClick={runAudit}
          disabled={auditRunning || enabledCount === 0}
          className="btn-primary"
          style={{ background: '#16a766', opacity: (auditRunning || enabledCount === 0) ? 0.6 : 1 }}
        >
          {auditRunning ? `Processing… (${auditTotal.toLocaleString()} done)` : '▶ Run Audit Now'}
        </button>
        {enabledCount === 0 && <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enable at least one category or custom rule first.</p>}
      </section>

      {/* ── Section 4: Signature ── */}
      <section className="glass-panel" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>Email Signature</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>Appended to every email sent from Linear Mail.</p>
        <form onSubmit={handleSaveSignature} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px' }}>
          <div style={{ border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', gap: '4px', padding: '6px 10px', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
              {[['bold','B'],['italic','I'],['underline','U']].map(([cmd, label]) => (
                <button key={cmd} type="button"
                  onMouseDown={e => { e.preventDefault(); signatureEditor?.chain().focus()[`toggle${cmd.charAt(0).toUpperCase()+cmd.slice(1)}`]().run(); }}
                  style={{ background: signatureEditor?.isActive(cmd) ? 'var(--accent)' : 'transparent', color: signatureEditor?.isActive(cmd) ? '#fff' : 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '2px 9px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                  {label}
                </button>
              ))}
            </div>
            <EditorContent editor={signatureEditor} />
          </div>
          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 24px' }}>
            {signatureStatus}
          </button>
        </form>
      </section>

      {/* ── Section 5: Send-As Alias ── */}
      <section className="glass-panel" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>Send-As Alias</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
          Add another email address to send from. Google will send a verification email to confirm.
        </p>
        <form onSubmit={handleAddAlias} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Display name</label>
            <input value={aliasName} onChange={e => setAliasName(e.target.value)} required placeholder="e.g. Nitesh — Nanoliss" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email address</label>
            <input type="email" value={aliasEmail} onChange={e => setAliasEmail(e.target.value)} required placeholder="e.g. hello@nanoliss.com" style={inputStyle} />
          </div>
          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 24px' }} disabled={aliasStatus === "Adding…"}>
            {aliasStatus}
          </button>
        </form>
      </section>

    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--glass-border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
};
