"use client";

import { useState, useRef, useEffect } from "react";

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
  const [body, setBody] = useState(initialBody);
  const [from, setFrom] = useState(userEmail);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState(initialAttachments);
  
  const [draftId, setDraftId] = useState(initialDraftId);
  const [saveStatus, setSaveStatus] = useState("");

  const [aiLoading, setAiLoading] = useState(false);

  const toDropdownRef = useRef(null);
  const ccDropdownRef = useRef(null);
  const bccDropdownRef = useRef(null);
  const editorRef = useRef(null);
  const autoSaveTimer = useRef(null);

  // Set initial body content once on mount
  useEffect(() => {
    if (editorRef.current && initialBody) {
      const isHTML = /<[a-z][\s\S]*>/i.test(initialBody);
      editorRef.current.innerHTML = isHTML ? initialBody : initialBody.replace(/\n/g, '<br>');
    }
  }, []);

  const getBodyHTML = () => editorRef.current?.innerHTML || '';

  const triggerAutoSave = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const currentTo = to; // captured at call time via closure refresh below
    autoSaveTimer.current = setTimeout(async () => {
      const html = getBodyHTML();
      if (!to && !cc && !bcc && !subject && !html && attachments.length === 0) return;
      setSaveStatus("Saving…");
      try {
        const payload = { draftId, to, cc, bcc, subject, body: html, from, attachments, accountId: initialAccountId };
        const res = await fetch("/api/gmail/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.draftId) {
          setDraftId(data.draftId);
          setSaveStatus("Saved");
          setTimeout(() => setSaveStatus(""), 2500);
        }
      } catch {
        setSaveStatus("Save failed");
      }
    }, 2000);
  };

  // Trigger auto-save when header fields change
  useEffect(() => {
    triggerAutoSave();
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [to, cc, bcc, subject, from, attachments]);

  const [aliases, setAliases] = useState([]);

  useEffect(() => {
    // If we have an active account, fetch aliases
    if (initialAccountId) {
      fetch(`/api/gmail/alias?accountId=${initialAccountId}`)
        .then(res => res.json())
        .then(data => {
          if (data.aliases) {
            setAliases(data.aliases);
          }
        })
        .catch(console.error);
    }
  }, [initialAccountId]);

  const handleSend = async (e, scheduledDate = null) => {
    if (e) e.preventDefault();
    const payload = {
      accountId: initialAccountId,
      to,
      cc,
      bcc,
      from,
      subject,
      body: getBodyHTML(),
      attachments
    };

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

  const savedSelectionRef = useRef(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("");

  const handleAIDraft = async (command) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (!selectedText) {
      alert("Please highlight some text in the email body first to use AI editing!");
      setAiMenuOpen(false);
      return;
    }

    // Save the selection range so we can replace it after the async call
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
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

      if (range) {
        range.deleteContents();
        range.insertNode(document.createTextNode(data.result));
      }
    } catch (error) {
      alert("AI Drafting Error: " + error.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="pop-in" style={isInline ? {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'transparent',
      padding: '32px'
    } : {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      width: '500px',
      minHeight: '480px',
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
            {aliases.map(a => {
              const name = a.displayName ? a.displayName : "Alias";
              return (
                <option key={a.sendAsEmail} value={`"${name}" <${a.sendAsEmail}>`}>
                  {a.displayName ? `${a.displayName} (${a.sendAsEmail})` : a.sendAsEmail}
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ position: 'relative', display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '12px 16px' }}>
          <label style={{ width: '60px', color: 'var(--text-secondary)' }}>To:</label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onFocus={() => { if (toDropdownRef.current) toDropdownRef.current.style.display = 'block'; }}
            onBlur={() => setTimeout(() => { if (toDropdownRef.current) toDropdownRef.current.style.display = 'none'; }, 200)}
            style={{ flex: 1, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', outline: 'none' }}
          />
          <div ref={toDropdownRef} style={{ display: 'none', position: 'absolute', top: '100%', left: '76px', right: '16px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
            {contacts.filter(c => c.toLowerCase().includes(to.toLowerCase()) && c !== to).slice(0, 10).map((c, i) => (
              <div key={i} onClick={() => { setTo(c); if (toDropdownRef.current) toDropdownRef.current.style.display = 'none'; }} style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-primary)' }} onMouseOver={e => e.currentTarget.style.background='var(--glass-border)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                {c}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '12px 16px' }}>
          <label style={{ width: '60px', color: 'var(--text-secondary)' }}>Cc:</label>
          <input
            type="text"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            onFocus={() => { if (ccDropdownRef.current) ccDropdownRef.current.style.display = 'block'; }}
            onBlur={() => setTimeout(() => { if (ccDropdownRef.current) ccDropdownRef.current.style.display = 'none'; }, 200)}
            style={{ flex: 1, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', outline: 'none' }}
          />
          <div ref={ccDropdownRef} style={{ display: 'none', position: 'absolute', top: '100%', left: '76px', right: '16px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
            {contacts.filter(c => c.toLowerCase().includes(cc.toLowerCase()) && c !== cc).slice(0, 10).map((c, i) => (
              <div key={i} onClick={() => { setCc(c); if (ccDropdownRef.current) ccDropdownRef.current.style.display = 'none'; }} style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-primary)' }} onMouseOver={e => e.currentTarget.style.background='var(--glass-border)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                {c}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '12px 16px' }}>
          <label style={{ width: '60px', color: 'var(--text-secondary)' }}>Bcc:</label>
          <input
            type="text"
            value={bcc}
            onChange={(e) => setBcc(e.target.value)}
            onFocus={() => { if (bccDropdownRef.current) bccDropdownRef.current.style.display = 'block'; }}
            onBlur={() => setTimeout(() => { if (bccDropdownRef.current) bccDropdownRef.current.style.display = 'none'; }, 200)}
            style={{ flex: 1, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', outline: 'none' }}
          />
          <div ref={bccDropdownRef} style={{ display: 'none', position: 'absolute', top: '100%', left: '76px', right: '16px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
            {contacts.filter(c => c.toLowerCase().includes(bcc.toLowerCase()) && c !== bcc).slice(0, 10).map((c, i) => (
              <div key={i} onClick={() => { setBcc(c); if (bccDropdownRef.current) bccDropdownRef.current.style.display = 'none'; }} style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-primary)' }} onMouseOver={e => e.currentTarget.style.background='var(--glass-border)'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                {c}
              </div>
            ))}
          </div>
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

        {/* Rich text toolbar */}
        <div style={{ display: 'flex', gap: '4px', padding: '6px 12px', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
          {[
            { cmd: 'bold',      label: <b>B</b> },
            { cmd: 'italic',    label: <i>I</i> },
            { cmd: 'underline', label: <u>U</u> },
          ].map(({ cmd, label }) => (
            <button
              key={cmd}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd); editorRef.current?.focus(); }}
              style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '4px', padding: '2px 10px', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              const url = window.prompt('Link URL:');
              if (url) { document.execCommand('createLink', false, url); editorRef.current?.focus(); }
            }}
            style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '4px', padding: '2px 10px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            🔗
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); document.execCommand('removeFormat'); editorRef.current?.focus(); }}
            style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', borderRadius: '4px', padding: '2px 10px', cursor: 'pointer', fontSize: '0.75rem' }}
            title="Clear formatting"
          >
            Tx
          </button>
        </div>

        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            ref={editorRef}
            contentEditable="true"
            suppressContentEditableWarning={true}
            onInput={triggerAutoSave}
            style={{
              flex: 1,
              minHeight: '220px',
              padding: '16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: '1.6',
              overflowY: 'auto',
            }}
            data-placeholder="Type your message… Highlight text and click ✨ AI Draft to edit."
          />
          {aiLoading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', borderRadius: '4px' }}>
              ✨ AI is drafting…
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
                <span style={{ fontSize: '1.2rem' }}>📎</span> Attach
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setAiMenuOpen(!aiMenuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '1.2rem' }}>✨</span> AI Draft
              </button>
              {aiMenuOpen && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  padding: '8px 0',
                  zIndex: 1001,
                  minWidth: '200px'
                }}>
                  <div style={{ padding: '4px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>✨ AI Assistant</div>
                  {[
                    "Formalize",
                    "Fix Spelling & Grammar",
                    "Make Professional",
                    "Make Concise"
                  ].map(cmd => (
                    <div 
                      key={cmd}
                      onClick={() => handleAIDraft(cmd)}
                      style={{ padding: '8px 16px', cursor: 'pointer', fontSize: '0.9rem', transition: 'background 0.2s', color: 'var(--text-primary)' }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass-border)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {cmd}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', transition: 'opacity 0.3s', opacity: saveStatus ? 1 : 0 }}>
              {saveStatus}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              type="button" 
              onClick={handleDiscard}
              style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
            >
              🗑️ Discard
            </button>
            <div style={{ position: 'relative' }}>
              <button 
                type="button" 
                onClick={() => setShowSchedule(!showSchedule)}
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '8px 0 0 8px', cursor: 'pointer' }}
              >
                🕒
              </button>
              {showSchedule && (
                <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 1002, display: 'flex', flexDirection: 'column', gap: '8px', width: '250px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Schedule to send at:</label>
                  <input type="datetime-local" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)' }} />
                  <button type="button" className="btn-primary" onClick={() => handleSend(null, scheduleTime)} disabled={!scheduleTime || !to}>
                    Schedule Send
                  </button>
                </div>
              )}
            </div>
            <button 
              type="submit" 
              disabled={sending || aiLoading || !to}
              className="btn-primary" 
              style={{ padding: '8px 24px', borderRadius: '0 8px 8px 0', opacity: (sending || aiLoading || !to) ? 0.7 : 1 }}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
