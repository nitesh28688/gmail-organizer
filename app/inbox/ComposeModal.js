"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";

const ToolbarBtn = ({ onClick, active, title, children }) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    style={{
      background: active ? "var(--accent)" : "transparent",
      color: active ? "#fff" : "var(--text-primary)",
      border: "1px solid var(--glass-border)",
      borderRadius: "4px", padding: "2px 10px",
      cursor: "pointer", fontSize: "0.9rem", fontWeight: 600,
    }}
  >
    {children}
  </button>
);

export default function ComposeModal({
  onClose,
  userEmail,
  initialDraftId = null,
  initialTo = "",
  initialCc = "",
  initialBcc = "",
  initialSubject = "",
  initialBody = "",
  initialAttachments = [],
  initialAccountId = null,
  contacts = [],
  isInline = false
}) {
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState(initialCc);
  const [bcc, setBcc] = useState(initialBcc);
  const [subject, setSubject] = useState(initialSubject);
  const [from, setFrom] = useState(userEmail);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [draftId, setDraftId] = useState(initialDraftId);
  const [saveStatus, setSaveStatus] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");
  const [aliases, setAliases] = useState([]);
  const [expanded, setExpanded] = useState(true);

  const toDropdownRef = useRef(null);
  const ccDropdownRef = useRef(null);
  const bccDropdownRef = useRef(null);
  const autoSaveTimer = useRef(null);

  // Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    editorProps: {
      attributes: {
        "data-placeholder": "Type your message… Select text and use AI Draft to rewrite.",
        class: "lm-editor",
      },
    },
    onUpdate: () => triggerAutoSave(),
  });

  // Set initial body content once editor is ready
  useEffect(() => {
    if (!editor || !initialBody) return;
    const isHTML = /<[a-z][\s\S]*>/i.test(initialBody);
    editor.commands.setContent(isHTML ? initialBody : initialBody.replace(/\n/g, "<br>"), false);
  }, [editor, initialBody]);

  const getBodyHTML = useCallback(() => editor?.getHTML() ?? "", [editor]);

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const html = getBodyHTML();
      if (!to && !cc && !bcc && !subject && html === "<p></p>" && attachments.length === 0) return;
      setSaveStatus("Saving…");
      try {
        const res = await fetch("/api/gmail/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId, to, cc, bcc, subject, body: html, from, attachments, accountId: initialAccountId })
        });
        const data = await res.json();
        if (data.draftId) {
          setDraftId(data.draftId);
          setSaveStatus("Saved");
          setTimeout(() => setSaveStatus(""), 2500);
        }
      } catch { setSaveStatus("Save failed"); }
    }, 2000);
  }, [attachments, bcc, cc, draftId, from, getBodyHTML, initialAccountId, subject, to]);

  // Clean up auto-save timer on unmount
  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  useEffect(() => {
    if (!initialAccountId) return;
    fetch(`/api/gmail/alias?accountId=${initialAccountId}`)
      .then(r => r.json())
      .then(d => { if (d.aliases) setAliases(d.aliases); })
      .catch(console.error);
  }, [initialAccountId]);

  const handleSend = (e, scheduledDate = null) => {
    if (e) e.preventDefault();
    const payload = { accountId: initialAccountId, to, cc, bcc, from, subject, body: getBodyHTML(), attachments };
    if (scheduledDate) {
      onClose({ type: "SCHEDULE", payload, draftId, executeAt: scheduledDate });
    } else {
      onClose({ type: "SEND_NOW", payload, draftId });
    }
  };

  const handleDiscard = async () => {
    if (draftId) {
      await fetch("/api/gmail/draft", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, accountId: initialAccountId })
      });
    }
    onClose(false);
  };

  const handleFileChange = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setAttachments(prev => [...prev, {
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        data: ev.target.result.split(",")[1],
      }]);
      reader.readAsDataURL(file);
    });
  };

  const handleAIDraft = async (command) => {
    if (!editor) return;
    const { from: selFrom, to: selTo } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(selFrom, selTo, " ").trim();

    if (!selectedText) {
      alert("Highlight some text in the body first, then click AI Draft.");
      setAiMenuOpen(false);
      return;
    }

    setAiMenuOpen(false);
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, command }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      editor.chain().focus().deleteRange({ from: selFrom, to: selTo }).insertContentAt(selFrom, data.result).run();
    } catch (err) {
      alert("AI Drafting Error: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const setLink = () => {
    const prev = editor?.getAttributes("link").href || "";
    const url = window.prompt("Link URL:", prev);
    if (url === null) return;
    if (url === "") { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="pop-in" style={isInline ? {
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      background: "transparent", padding: "32px"
    } : expanded ? {
      position: "fixed", top: "4vh", left: 0, right: 0, margin: "0 auto",
      width: "min(860px, calc(100vw - 48px))", height: "92vh",
      background: "var(--bg-surface)", border: "1px solid var(--glass-border)",
      borderRadius: "16px", boxShadow: "0 32px 64px rgba(0,0,0,0.6)",
      display: "flex", flexDirection: "column", zIndex: 1000, overflow: "hidden"
    } : {
      position: "fixed", bottom: "24px", right: "24px",
      width: "min(540px, calc(100vw - 48px))", minHeight: "480px",
      background: "var(--bg-surface)", border: "1px solid var(--glass-border)",
      borderRadius: "16px", boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
      display: "flex", flexDirection: "column", zIndex: 1000, overflow: "hidden"
    }}>

      <header style={{ padding: "16px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--glass-bg)" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{draftId ? "Resume Draft" : "New Message"}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            title={expanded ? "Collapse" : "Expand"}
            style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1rem", padding: "2px 6px", lineHeight: 1 }}
          >
            {expanded ? "⊡" : "⊞"}
          </button>
          <button onClick={() => onClose(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
        </div>
      </header>

      <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

        {/* From */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--glass-border)", padding: "6px 16px" }}>
          <label style={{ width: "60px", color: "var(--text-secondary)", lineHeight: "28px" }}>From:</label>
          <select value={from} onChange={e => { setFrom(e.target.value); triggerAutoSave(); }} style={{ flex: 1, background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", padding: "4px 8px", borderRadius: "4px", outline: "none" }}>
            <option value={userEmail}>{userEmail}</option>
            {aliases.filter(a => a.sendAsEmail.toLowerCase() !== userEmail.toLowerCase()).map(a => (
              <option key={a.sendAsEmail} value={`"${a.displayName || "Alias"}" <${a.sendAsEmail}>`}>
                {a.displayName ? `${a.displayName} (${a.sendAsEmail})` : a.sendAsEmail}
              </option>
            ))}
          </select>
        </div>

        {/* To / CC / BCC */}
        {[
          { label: "To:", val: to, set: setTo, ref: toDropdownRef, id: "to" },
          { label: "Cc:", val: cc, set: setCc, ref: ccDropdownRef, id: "cc" },
          { label: "Bcc:", val: bcc, set: setBcc, ref: bccDropdownRef, id: "bcc" },
        ].map(({ label, val, set, ref, id }) => (
          <div key={id} style={{ position: "relative", display: "flex", borderBottom: "1px solid var(--glass-border)", padding: "6px 16px", alignItems: "center" }}>
            <label style={{ width: "60px", color: "var(--text-secondary)" }}>{label}</label>
            <input
              type="text" value={val} onChange={e => { set(e.target.value); triggerAutoSave(); }}
              onFocus={() => { if (ref.current) ref.current.style.display = "block"; }}
              onBlur={() => setTimeout(() => { if (ref.current) ref.current.style.display = "none"; }, 200)}
              style={{ flex: 1, background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", padding: "4px 8px", borderRadius: "4px", outline: "none" }}
            />
            <div ref={ref} style={{ display: "none", position: "absolute", top: "100%", left: "76px", right: "16px", background: "var(--bg-surface)", border: "1px solid var(--glass-border)", borderRadius: "8px", zIndex: 10, maxHeight: "200px", overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
              {contacts.filter(c => c.toLowerCase().includes(val.toLowerCase()) && c !== val).slice(0, 10).map((c, i) => (
                <div key={i} onClick={() => { set(c); if (ref.current) ref.current.style.display = "none"; }}
                  style={{ padding: "8px 16px", cursor: "pointer", borderBottom: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
                  onMouseOver={e => e.currentTarget.style.background = "var(--glass-border)"}
                  onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                  {c}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Subject */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--glass-border)", padding: "6px 16px", alignItems: "center" }}>
          <label style={{ width: "60px", color: "var(--text-secondary)" }}>Subject:</label>
          <input type="text" value={subject} onChange={e => { setSubject(e.target.value); triggerAutoSave(); }}
            style={{ flex: 1, background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", padding: "4px 8px", borderRadius: "4px", outline: "none" }} />
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", gap: "4px", padding: "6px 12px", borderBottom: "1px solid var(--glass-border)", background: "var(--glass-bg)", flexWrap: "wrap" }}>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")} title="Bold"><b>B</b></ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")} title="Italic"><i>I</i></ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive("underline")} title="Underline"><u>U</u></ToolbarBtn>
          <ToolbarBtn onClick={setLink} active={editor?.isActive("link")} title="Link">🔗</ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")} title="Bullet list">• List</ToolbarBtn>
          <ToolbarBtn onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} active={false} title="Clear formatting"><span style={{ fontSize: "0.75rem" }}>Tx</span></ToolbarBtn>
        </div>

        {/* Tiptap Editor */}
        <div style={{ position: "relative", flex: 1, overflowY: "auto" }}>
          <EditorContent editor={editor} />
          {aiLoading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold" }}>
              ✨ AI is drafting…
            </div>
          )}
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div style={{ padding: "8px 16px", borderTop: "1px solid var(--glass-border)", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {attachments.map((att, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", background: "var(--glass-border)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem" }}>
                <span style={{ maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.filename}</span>
                <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "16px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div>
              <input type="file" id="file-upload" multiple onChange={handleFileChange} style={{ display: "none" }} />
              <label htmlFor="file-upload" style={{ cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "1.2rem" }}>📎</span> Attach
              </label>
            </div>
            <div style={{ position: "relative" }}>
              <button type="button" onClick={() => setAiMenuOpen(!aiMenuOpen)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "1.2rem" }}>✨</span> AI Draft
              </button>
              {aiMenuOpen && (
                <div style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: "8px", background: "var(--bg-surface)", border: "1px solid var(--glass-border)", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", padding: "8px 0", zIndex: 1001, minWidth: "200px" }}>
                  <div style={{ padding: "4px 16px", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>✨ AI Assistant</div>
                  {["Formalize", "Fix Spelling & Grammar", "Make Professional", "Make Concise"].map(cmd => (
                    <div key={cmd} onClick={() => handleAIDraft(cmd)}
                      style={{ padding: "8px 16px", cursor: "pointer", fontSize: "0.9rem", color: "var(--text-primary)" }}
                      onMouseOver={e => e.currentTarget.style.background = "var(--glass-border)"}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      {cmd}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", opacity: saveStatus ? 1 : 0, transition: "opacity 0.3s" }}>{saveStatus}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button type="button" onClick={handleDiscard} style={{ background: "transparent", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" }}>
              🗑️ Discard
            </button>
            <div style={{ position: "relative" }}>
              <button type="button" onClick={() => setShowSchedule(!showSchedule)} style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", padding: "8px 12px", borderRadius: "8px 0 0 8px", cursor: "pointer" }}>🕒</button>
              {showSchedule && (
                <div style={{ position: "absolute", bottom: "100%", right: 0, marginBottom: "8px", padding: "16px", background: "var(--bg-surface)", border: "1px solid var(--glass-border)", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", zIndex: 1002, display: "flex", flexDirection: "column", gap: "8px", width: "250px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Schedule send:</label>
                  <input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--glass-border)", background: "var(--glass-bg)", color: "var(--text-primary)" }} />
                  <button type="button" className="btn-primary" onClick={() => handleSend(null, scheduleTime)} disabled={!scheduleTime || !to}>Schedule Send</button>
                </div>
              )}
            </div>
            <button type="submit" disabled={sending || aiLoading || !to} className="btn-primary" style={{ padding: "8px 24px", borderRadius: "0 8px 8px 0", opacity: (sending || aiLoading || !to) ? 0.7 : 1 }}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
