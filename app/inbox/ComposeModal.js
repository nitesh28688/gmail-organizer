"use client";

import { useState, useRef, useEffect } from "react";

export default function ComposeModal({ 
  onClose, 
  userEmail,
  initialDraftId = null,
  initialTo = "",
  initialSubject = "",
  initialBody = "",
  initialAttachments = [],
  initialAccountId = null
}) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [from, setFrom] = useState(userEmail);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState(initialAttachments);
  
  const [draftId, setDraftId] = useState(initialDraftId);
  const [saveStatus, setSaveStatus] = useState(""); // "Saving...", "Saved"
  
  const [contextMenu, setContextMenu] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Auto-save logic (debounced)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // Only auto-save if there is some content
    if (!to && !subject && !body && attachments.length === 0) return;

    setSaveStatus("Saving...");
    const timeoutId = setTimeout(async () => {
      try {
        const payload = { draftId, to, subject, body, from, attachments, accountId: initialAccountId };
        const res = await fetch("/api/gmail/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.draftId) {
          setDraftId(data.draftId);
          setSaveStatus("Saved to Drafts");
          setTimeout(() => setSaveStatus(""), 3000);
        }
      } catch (e) {
        setSaveStatus("Error saving draft");
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [to, subject, body, from, attachments]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const [aliases, setAliases] = useState([]);

  useEffect(() => {
    // If we have an active account, fetch aliases
    if (activeAccountId) {
      fetch(`/api/gmail/alias?accountId=${activeAccountId}`)
        .then(res => res.json())
        .then(data => {
          if (data.aliases) {
            setAliases(data.aliases);
          }
        })
        .catch(console.error);
    }
  }, [activeAccountId]);

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);

    try {
      const payload = {
        accountId: activeAccountId,
        to,
        from,
        subject,
        body,
        attachments
      };

      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      window.dispatchEvent(new CustomEvent("toast", { detail: "Message sent successfully" }));
      onClose(true);
    } catch (error) {
      console.error("Failed to send", error);
      alert("Failed to send message: " + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            data: ev.target.result.split(",")[1],
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleContextMenu = (e) => {
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    if (selectedText.trim().length > 0) {
      e.preventDefault(); // Only block right-click if text is selected for AI
      setContextMenu({ x: e.clientX, y: e.clientY, start, end, selectedText });
    } else {
      setContextMenu(null); // Default context menu will show
    }
  };

  const handleAIDraft = async (command) => {
    if (!contextMenu) return;
    const { start, end, selectedText } = contextMenu;
    setContextMenu(null);
    setAiLoading(true);

    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, command }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newBody = body.substring(0, start) + data.result + body.substring(end);
      setBody(newBody);
    } catch (error) {
      alert("AI Drafting Error: " + error.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="pop-in" style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '500px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--glass-border)',
      borderRadius: '16px',
      boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      <header style={{ 
        padding: '16px', 
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--glass-bg)'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
          {draftId ? "Resume Draft" : "New Message"}
        </h3>
        <button onClick={() => onClose(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
      </header>

      <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '12px 16px' }}>
          <label style={{ width: '60px', color: 'var(--text-secondary)' }}>From:</label>
          <select 
            value={from} 
            onChange={(e) => setFrom(e.target.value)}
            style={{ flex: 1, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', outline: 'none' }}
          >
            <option value={userEmail}>{userEmail}</option>
            {aliases.map(a => (
              <option key={a.sendAsEmail} value={`"${a.displayName}" <${a.sendAsEmail}>`}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '12px 16px' }}>
          <label style={{ width: '60px', color: 'var(--text-secondary)' }}>To:</label>
          <input 
            type="email" 
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ flex: 1, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '12px 16px' }}>
          <label style={{ width: '60px', color: 'var(--text-secondary)' }}>Subject:</label>
          <input 
            type="text" 
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ flex: 1, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', outline: 'none' }}
          />
        </div>

        <div style={{ position: 'relative' }}>
          <textarea 
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onContextMenu={handleContextMenu}
            style={{ 
              width: '100%',
              height: '250px', 
              padding: '16px', 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-primary)', 
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit'
            }}
            placeholder="Type your message here. Right-click selected text for AI drafting features!"
          />
          {aiLoading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
              ✨ AI is drafting...
            </div>
          )}
        </div>

        {attachments.length > 0 && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--glass-border)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {attachments.map((att, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--glass-border)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
                <button type="button" onClick={() => removeAttachment(i)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: '16px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <input type="file" id="file-upload" multiple onChange={handleFileChange} style={{ display: 'none' }} />
              <label htmlFor="file-upload" style={{ cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '1.2rem' }}>📎</span> Add attachment
              </label>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', transition: 'opacity 0.3s', opacity: saveStatus ? 1 : 0 }}>
              {saveStatus}
            </span>
          </div>
          <button 
            type="submit" 
            disabled={sending || aiLoading || !to}
            className="btn-primary" 
            style={{ padding: '8px 24px', opacity: (sending || aiLoading || !to) ? 0.7 : 1 }}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>

      {contextMenu && (
        <div style={{
          position: 'fixed',
          top: contextMenu.y,
          left: contextMenu.x,
          background: 'var(--bg-surface)',
          border: '1px solid var(--glass-border)',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          padding: '8px 0',
          zIndex: 1001,
          minWidth: '200px'
        }}>
          <div style={{ padding: '4px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>✨ AI Draft Assistant</div>
          {[
            "Formalize",
            "Fix Spelling & Grammar",
            "Make Professional",
            "Make Concise"
          ].map(cmd => (
            <div 
              key={cmd}
              onClick={() => handleAIDraft(cmd)}
              style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '0.9rem', transition: 'background 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass-border)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {cmd}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
