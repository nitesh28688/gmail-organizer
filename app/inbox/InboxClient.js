"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import ComposeModal from "./ComposeModal";
import AIAssistant from "./AIAssistant";
import CmdKPalette from "./CmdKPalette";
import OnboardingModal from "./OnboardingModal";

export default function InboxPage() {
  const searchParams = useSearchParams();
  const space = searchParams.get("space") || "Inbox";
  const activeAccountId = searchParams.get("account") || "";
  
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeEmail, setActiveEmail] = useState(null);
  const [loadingBody, setLoadingBody] = useState(false);
  
  // Undo Send State
  const pendingSendRef = useRef(null);
  const [undoToast, setUndoToast] = useState("");
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [userLabels, setUserLabels] = useState([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [apiContacts, setApiContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  
  // Compose State
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAttachments, setComposeAttachments] = useState([]);
  
  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterTo, setFilterTo] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterAttachment, setFilterAttachment] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  
  // Multi-Select State
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const touchStartX = useRef(null);

  // Toast State
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetch("/api/cron").catch(() => {});
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // Auto-refresh inbox every 60s when idle (no email open, no compose)
  useEffect(() => {
    const refreshId = setInterval(() => {
      if (!activeEmail && !composeOpen) fetchInbox();
    }, 60000);
    return () => clearInterval(refreshId);
  }, [activeEmail, composeOpen]);

  const handleComposeClose = async (result) => {
    setComposeOpen(false);
    if (!result) return;
    
    if (result.type === "SCHEDULE") {
      try {
        await fetch("/api/gmail/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "SEND_LATER", executeAt: result.executeAt, ...result.payload })
        });
        if (result.draftId) {
          await fetch("/api/gmail/draft", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: result.draftId, accountId: result.payload.accountId }) });
        }
        showToast("Email scheduled successfully! 🕒");
        setTimeout(() => fetchInbox(), 1000);
      } catch (e) {
        showToast("Error scheduling email");
      }
    } else if (result.type === "SEND_NOW") {
      if (result.draftId) {
        const deletePromise = fetch("/api/gmail/draft", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: result.draftId, accountId: result.payload.accountId }) }).catch(e => console.error(e));
        if (space === "Drafts") {
          setActiveEmail(null);
          deletePromise.then(() => fetchInbox());
        }
      }

      let seconds = 20;
      setUndoToast(`Sending in ${seconds}s...`);
      
      const countdownTimerId = setInterval(() => {
        seconds -= 1;
        if (seconds > 0) {
          setUndoToast(`Sending in ${seconds}s...`);
        } else {
          setUndoToast("");
        }
      }, 1000);

      const timerId = setTimeout(async () => {
        clearInterval(countdownTimerId);
        setUndoToast("");
        try {
          await fetch("/api/gmail/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result.payload)
          });
          showToast("Email Sent Successfully! 🚀");
          fetchInbox();
        } catch (e) {
          showToast("Failed to send email");
        }
        pendingSendRef.current = null;
      }, 20000);

      pendingSendRef.current = { payload: result.payload, draftId: result.draftId, timerId, countdownTimerId };
    }
  };

  const handleUndo = () => {
    if (pendingSendRef.current) {
      clearTimeout(pendingSendRef.current.timerId);
      clearInterval(pendingSendRef.current.countdownTimerId);
      
      setComposeTo(pendingSendRef.current.payload.to);
      setComposeSubject(pendingSendRef.current.payload.subject);
      setComposeBody(pendingSendRef.current.payload.body);
      setComposeAttachments(pendingSendRef.current.payload.attachments);
      setComposeOpen(true);
      
      pendingSendRef.current = null;
      setUndoToast("");
      showToast("Send undone.");
    }
  };

  const handleSnooze = async (email, time) => {
    let executeAt = new Date();
    if (time === "LATER_TODAY") {
      executeAt.setHours(18, 0, 0, 0);
      if (executeAt < new Date()) executeAt.setDate(executeAt.getDate() + 1);
    } else if (time === "TOMORROW") {
      executeAt.setDate(executeAt.getDate() + 1);
      executeAt.setHours(8, 0, 0, 0);
    } else if (time === "NEXT_WEEK") {
      executeAt.setDate(executeAt.getDate() + 7);
      executeAt.setHours(8, 0, 0, 0);
    }

    try {
      await fetch("/api/gmail/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "SNOOZE", executeAt: executeAt.toISOString(), accountId: email.accountId, messageId: email.id })
      });
      await fetch("/api/gmail/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ id: email.id, accountId: email.accountId }] })
      });
      showToast("Email snoozed 💤");
      setSnoozeMenuOpen(false);
      setActiveEmail(null);
      fetchInbox();
    } catch (e) {
      showToast("Error snoozing email");
    }
  };

  const fetchLabels = async () => {
    try {
      const res = await fetch(`/api/gmail/labels?accountId=${activeAccountId}`);
      const data = await res.json();
      if (data.labels) setUserLabels(data.labels);
    } catch(e) { console.error("Failed to fetch labels", e); }
  };

  const handleEmailClick = async (email) => {
    setActiveEmail({ ...email, isLoading: true, threadMessages: [] });
    setThreadSearch("");
    try {
      const res = await fetch(`/api/gmail/thread?threadId=${email.threadId}&accountId=${email.accountId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const threadMessages = data.messages || [];
      setActiveEmail({ ...email, threadMessages, isLoading: false });
      
      if (email.isUnread) {
        setEmails(prev => prev.map(m => m.id === email.id ? { ...m, isUnread: false } : m));
      }
    } catch (e) {
      console.error(e);
      showToast("Error loading thread");
      setActiveEmail(null);
    }
  };

  const handleMove = async (labelId) => {
    try {
      await fetch("/api/gmail/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ id: activeEmail.id, accountId: activeEmail.accountId }], labelId })
      });
      showToast("Email moved successfully 📦");
      setMoveMenuOpen(false);
      setActiveEmail(null);
      fetchInbox();
    } catch(e) { showToast("Error moving email"); }
  };

  const handleCreateLabel = async (e) => {
    e.preventDefault();
    if (!newLabelName) return;
    setCreatingLabel(true);
    try {
      const res = await fetch("/api/gmail/labels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: activeAccountId, name: newLabelName }) });
      const data = await res.json();
      if (data.label) handleMove(data.label.id);
    } catch(e) { showToast("Error creating label"); }
    finally { setCreatingLabel(false); setNewLabelName(""); }
  };

  const buildQuery = () => {
    let baseQuery = "";
    if (space === "Inbox") baseQuery = "in:inbox";
    else if (space === "All Mail") baseQuery = "-in:trash";
    else if (space === "Drafts") baseQuery = "in:draft";
    else if (space === "Sent") baseQuery = "in:sent";
    else if (space === "Trash") baseQuery = "in:trash";
    else if (space === "Linear Ventures") baseQuery = "(to:linearventures.in OR from:linearventures.in) -in:trash -in:draft";
    else if (space === "Nanoliss") baseQuery = "(to:nanoliss.in OR from:nanoliss.in OR to:nanoliss.com OR from:nanoliss.com) -in:trash -in:draft";
    else if (space === "Services") baseQuery = "(receipt OR invoice OR order OR service) -in:trash -in:draft";
    else if (space === "Finance") baseQuery = "(bank OR statement OR payment OR finance) -in:trash -in:draft";
    else baseQuery = `(to:${space} OR from:${space}) -in:trash -in:draft`;
    let q = baseQuery;
    if (searchQuery) q += ` ${searchQuery}`;
    if (filterTo) q += ` to:${filterTo}`;
    if (filterFrom) q += ` from:${filterFrom}`;
    if (filterSubject) q += ` subject:${filterSubject}`;
    if (filterAttachment) q += ` has:attachment`;
    if (filterUnread) q += ` is:unread`;
    return q.trim();
  };

  const fetchInbox = async () => {
    const isBasicQuery = !searchQuery && !filterTo && !filterFrom && !filterSubject && !filterAttachment;
    const cacheKey = `${space}_${activeAccountId}`;
    if (isBasicQuery && typeof window !== 'undefined' && window.emailCache && window.emailCache[cacheKey]) {
      setEmails(window.emailCache[cacheKey]);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setActiveEmail(null);
    setSelectedEmails([]);
    setNextPageToken(null);
    try {
      const finalQuery = buildQuery();
      const res = await fetch(`/api/gmail/messages?q=${encodeURIComponent(finalQuery)}&accountId=${activeAccountId}`);
      const data = await res.json();
      setEmails(data.emails || []);
      setNextPageToken(data.nextPageToken || null);
      if (isBasicQuery && typeof window !== 'undefined') {
        window.emailCache = window.emailCache || {};
        window.emailCache[cacheKey] = data.emails || [];
      }
    } catch (e) {
      console.error("Failed to load emails", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMore = async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const finalQuery = buildQuery();
      const res = await fetch(`/api/gmail/messages?q=${encodeURIComponent(finalQuery)}&accountId=${activeAccountId}&pageToken=${nextPageToken}`);
      const data = await res.json();
      setEmails(prev => [...prev, ...(data.emails || [])]);
      setNextPageToken(data.nextPageToken || null);
    } catch (e) {
      console.error("Failed to load more emails", e);
    } finally {
      setLoadingMore(false);
    }
  };

  // Re-fetch when space or account changes
  useEffect(() => {
    setSearchQuery("");
    setFilterTo("");
    setFilterFrom("");
    setFilterSubject("");
    setFilterAttachment(false);
    setFilterUnread(false);
    fetchInbox();
    
    fetch("/api/gmail/contacts").then(r => r.json()).then(d => {
      if (d.contacts) setApiContacts(d.contacts);
    }).catch(e => console.error(e));

    fetch("/api/gmail/accounts").then(r => r.json()).then(d => {
      if (d.accounts) setAccounts(d.accounts);
    }).catch(e => console.error(e));
  }, [space, activeAccountId]);

  // Immediate fetch when unread toggle changes
  useEffect(() => {
    fetchInbox();
  }, [filterUnread]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchInbox();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.ctrlKey || e.metaKey) return;

      if (e.key === 'j' && !activeEmail) {
        // Move focus down (simple simulation for now by selecting first or next)
      } else if (e.key === 'r' && activeEmail) {
        setComposeTo(activeEmail.from);
        setComposeSubject(`Re: ${activeEmail.subject}`);
        setComposeBody("");
        setComposeOpen(true);
      } else if (e.key === 'c') {
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
        setComposeOpen(true);
      } else if (e.key === 'Escape' && activeEmail) {
        setActiveEmail(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeEmail]);

  useEffect(() => {
    const openCompose = () => {
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setComposeOpen(true);
    };
    window.addEventListener("openCompose", openCompose);
    return () => window.removeEventListener("openCompose", openCompose);
  }, []);

  const toggleSelect = (e, id) => {
    e.stopPropagation();
    if (selectedEmails.includes(id)) {
      setSelectedEmails(prev => prev.filter(emailId => emailId !== id));
    } else {
      setSelectedEmails(prev => [...prev, id]);
    }
  };

  const toggleSelectAll = (e) => {
    e.stopPropagation();
    if (selectedEmails.length === emails.length && emails.length > 0) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(emails.map(e => e.id));
    }
  };

  const handleMarkReadSelected = async () => {
    if (selectedEmails.length === 0) return;
    setIsDeleting(true);
    try {
      const messages = emails.filter(e => selectedEmails.includes(e.id)).map(e => ({ id: e.id, accountId: e.accountId }));
      const res = await fetch("/api/gmail/markRead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (!res.ok) throw new Error("Mark read failed");
      
      showToast(`${selectedEmails.length} messages marked as read ✅`);
      setEmails(prev => prev.map(e => selectedEmails.includes(e.id) ? { ...e, isUnread: false } : e));
      setSelectedEmails([]);
      window.dispatchEvent(new Event("refreshCounts"));
    } catch (e) {
      showToast("Error marking messages as read");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkUnreadSelected = async () => {
    if (selectedEmails.length === 0) return;
    setIsDeleting(true);
    try {
      const messages = emails.filter(e => selectedEmails.includes(e.id)).map(e => ({ id: e.id, accountId: e.accountId }));
      const res = await fetch("/api/gmail/markUnread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (!res.ok) throw new Error("Mark unread failed");
      
      showToast(`${selectedEmails.length} messages marked as unread ✉️`);
      setEmails(prev => prev.map(e => selectedEmails.includes(e.id) ? { ...e, isUnread: true } : e));
      setSelectedEmails([]);
      window.dispatchEvent(new Event("refreshCounts"));
    } catch (e) {
      showToast("Error marking messages as unread");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEmails.length === 0) return;
    setIsDeleting(true);
    try {
      const messages = emails.filter(e => selectedEmails.includes(e.id)).map(e => ({ id: e.id, accountId: e.accountId }));
      const res = await fetch("/api/gmail/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (!res.ok) throw new Error("Delete failed");
      
      showToast(`${selectedEmails.length} messages moved to Trash 🗑️`);
      if (selectedEmails.includes(activeEmail?.id)) setActiveEmail(null);
      setSelectedEmails([]);
      fetchInbox(); // Refresh list
    } catch (e) {
      showToast("Error deleting messages");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedEmails.length === 0) return;
    setIsDeleting(true);
    try {
      const messages = emails.filter(e => selectedEmails.includes(e.id)).map(e => ({ id: e.id, accountId: e.accountId }));
      const res = await fetch("/api/gmail/untrash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (!res.ok) throw new Error("Restore failed");
      
      showToast(`${selectedEmails.length} messages Restored ♻️`);
      if (selectedEmails.includes(activeEmail?.id)) setActiveEmail(null);
      setSelectedEmails([]);
      fetchInbox(); // Refresh list
    } catch (e) {
      showToast("Error restoring messages");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (selectedEmails.length === 0) return;
    setIsDeleting(true);
    try {
      const messages = emails.filter(e => selectedEmails.includes(e.id)).map(e => ({ id: e.id, accountId: e.accountId }));
      const res = await fetch("/api/gmail/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (!res.ok) throw new Error("Delete failed");
      
      showToast(`${selectedEmails.length} messages permanently deleted 🔥`);
      if (selectedEmails.includes(activeEmail?.id)) setActiveEmail(null);
      setSelectedEmails([]);
      fetchInbox(); // Refresh list
    } catch (e) {
      showToast("Error deleting messages");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveSelected = async () => {
    if (selectedEmails.length === 0) return;
    setIsDeleting(true);
    try {
      const messages = emails.filter(e => selectedEmails.includes(e.id)).map(e => ({ id: e.id, accountId: e.accountId }));
      const res = await fetch("/api/gmail/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (!res.ok) throw new Error("Archive failed");
      showToast(`${selectedEmails.length} messages archived 📦`);
      if (selectedEmails.includes(activeEmail?.id)) setActiveEmail(null);
      setSelectedEmails([]);
      fetchInbox();
    } catch (e) {
      showToast("Error archiving messages");
    } finally {
      setIsDeleting(false);
    }
  };

  const isSentSpace = space === "Sent";
  const isDraftSpace = space === "Drafts";
  const isTrashSpace = space === "Trash";
  const allSelected = emails.length > 0 && selectedEmails.length === emails.length;

  // Extract contacts from loaded emails for autocomplete
  const localContacts = Array.from(new Set(emails.map(e => e.from).concat(emails.map(e => e.to)))).filter(Boolean).map(c => {
    const match = c.match(/(.*?) <(.*?)>/);
    return match ? match[2] : c;
  });
  const contacts = Array.from(new Set([...apiContacts, ...localContacts]));

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Email List Pane */}
      <div className={`mobile-list-pane ${activeEmail ? 'mobile-hidden' : ''}`} style={{ 
        width: '450px', 
        height: '100%', 
        overflowY: 'auto', 
        borderRight: '1px solid var(--glass-border)',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Universal Search Bar */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(10, 10, 10, 0.4)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(10px)' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                type="button" 
                className="mobile-only"
                onClick={() => window.dispatchEvent(new Event("toggleSidebar"))} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: '0 8px' }}>
                ☰
              </button>
              <button onClick={fetchInbox} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} title="Refresh Inbox">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.67-5.67"/></svg>
              </button>
              <input 
                type="text" 
                placeholder={`Search in ${space}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: '24px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', outline: 'none', minWidth: '100px' }}
              />
              <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); setFilterUnread(!filterUnread); }}
                style={{ 
                  background: filterUnread ? 'var(--text-primary)' : 'var(--glass-bg)', 
                  color: filterUnread ? 'var(--bg-color)' : 'var(--text-primary)',
                  border: '1px solid var(--glass-border)', 
                  borderRadius: '24px', 
                  padding: '8px 12px', 
                  cursor: 'pointer',
                  fontWeight: filterUnread ? '600' : '400',
                  fontSize: '0.85rem'
                }}>
                Unread
              </button>
              <button type="button" onClick={() => setShowFilters(!showFilters)} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '0 16px', color: 'var(--text-primary)', cursor: 'pointer', height: '38px' }}>
                ⚙️
              </button>
              <button type="button" onClick={() => setShowShortcuts(s => !s)} title="Keyboard shortcuts" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '0 12px', color: 'var(--text-secondary)', cursor: 'pointer', height: '38px', fontWeight: '700', fontSize: '0.9rem' }}>
                ?
              </button>
            </div>
            {showShortcuts && (
              <div className="pop-in" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: '0.82rem' }}>
                <div style={{ gridColumn: '1/-1', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Keyboard Shortcuts</div>
                {[['c', 'Compose'], ['r', 'Reply to open email'], ['Esc', 'Close email'], ['⌘/Ctrl+K', 'Command palette']].map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                    <kbd style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '2px 7px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{key}</kbd>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
            {showFilters && (
              <div className="pop-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '60px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>From</span>
                  <input type="text" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ flex: 1, padding: '4px 8px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '60px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>To</span>
                  <input type="text" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ flex: 1, padding: '4px 8px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: '60px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Subject</span>
                  <input type="text" value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ flex: 1, padding: '4px 8px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filterAttachment} onChange={e => setFilterAttachment(e.target.checked)} />
                  Has Attachment
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filterUnread} onChange={e => setFilterUnread(e.target.checked)} />
                  Unread Only
                </label>
                <button type="submit" className="btn-primary" style={{ padding: '6px', fontSize: '0.9rem', marginTop: '4px' }}>Apply Filters</button>
              </div>
            )}
          </form>
        </div>

        {/* Bulk Action / Select All Header */}
        {!loading && emails.length > 0 && (
          <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}>
            <input 
              type="checkbox" 
              checked={allSelected} 
              onChange={toggleSelectAll} 
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            {selectedEmails.length > 0 ? (
              <div className="pop-in" style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selectedEmails.length} selected</span>
                {isTrashSpace ? (
                  <>
                    <button 
                      onClick={handleRestoreSelected} 
                      disabled={isDeleting}
                      style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer', opacity: isDeleting ? 0.5 : 1 }}
                    >
                      {isDeleting ? "Working..." : "♻️ Restore"}
                    </button>
                    <button 
                      onClick={handlePermanentDelete} 
                      disabled={isDeleting}
                      style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer', opacity: isDeleting ? 0.5 : 1 }}
                    >
                      {isDeleting ? "Working..." : "🔥 Delete"}
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={handleMarkReadSelected} 
                      disabled={isDeleting}
                      style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer', opacity: isDeleting ? 0.5 : 1 }}
                    >
                      ✅ Read
                    </button>
                    <button 
                      onClick={handleMarkUnreadSelected} 
                      disabled={isDeleting}
                      style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer', opacity: isDeleting ? 0.5 : 1 }}
                    >
                      ✉️ Unread
                    </button>
                    <button
                      onClick={handleArchiveSelected}
                      disabled={isDeleting}
                      style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer', opacity: isDeleting ? 0.5 : 1 }}
                    >
                      📦 Archive
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={isDeleting}
                      style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer', opacity: isDeleting ? 0.5 : 1 }}
                    >
                      {isDeleting ? "Deleting..." : "🗑️ Trash"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select all</span>
            )}
          </div>
        )}

        {/* Email List */}
        {loading ? (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ display: 'flex', gap: '12px' }}>
                <div className="skeleton-box" style={{ width: '16px', height: '16px', borderRadius: '4px' }}></div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton-box" style={{ width: '40%', height: '16px' }}></div>
                  <div className="skeleton-box" style={{ width: '80%', height: '14px' }}></div>
                  <div className="skeleton-box" style={{ width: '60%', height: '12px', opacity: 0.6 }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', color: 'var(--text-secondary)', gap: '12px' }}>
            <span style={{ fontSize: '3rem', opacity: 0.2 }}>
              {space === 'Trash' ? '🗑️' : space === 'Sent' ? '📤' : space === 'Drafts' ? '📝' : space === 'Starred' ? '⭐' : '📭'}
            </span>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>
              {searchQuery || filterFrom || filterTo || filterSubject ? 'No results found' : `${space} is empty`}
            </p>
            <p style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>
              {searchQuery || filterFrom || filterTo || filterSubject ? 'Try adjusting your search or filters.' : 'Nothing here yet.'}
            </p>
          </div>
        ) : (
          <>
          {emails.map(email => {
            const displayParticipant = isSentSpace || isDraftSpace ? `To: ${email.to}` : email.from;
            const isSelected = selectedEmails.includes(email.id);
            const isActive = activeEmail?.id === email.id;

            return (
              <div 
                key={email.id}
                onClick={() => handleEmailClick(email)}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : (isActive ? 'var(--glass-bg)' : 'transparent'),
                  borderLeft: isSelected ? '4px solid var(--accent)' : '4px solid transparent',
                  transition: 'background 0.2s',
                  display: 'flex',
                  gap: '12px'
                }}
                onMouseOver={(e) => {
                  if (!isSelected && !isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseOut={(e) => {
                  if (!isSelected && !isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div onClick={(e) => e.stopPropagation()} style={{ paddingTop: '2px' }}>
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={(e) => toggleSelect(e, email.id)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const action = email.isStarred ? "UNSTAR" : "STAR";
                          // Optimistically update
                          setEmails(prev => prev.map(m => m.id === email.id ? { ...m, isStarred: !m.isStarred } : m));
                          if (activeEmail?.id === email.id) setActiveEmail(prev => ({ ...prev, isStarred: !prev.isStarred }));
                          fetch("/api/gmail/star", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action, messages: [{ id: email.id, accountId: email.accountId }] })
                          }).catch(() => showToast("Error starring email"));
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1.2rem', color: email.isStarred ? '#fbbf24' : 'var(--text-secondary)', opacity: email.isStarred ? 1 : 0.5, flexShrink: 0 }}
                      >
                        {email.isStarred ? '★' : '☆'}
                      </button>
                      <span style={{ fontWeight: isActive ? '700' : (email.isUnread ? '700' : '600'), color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {displayParticipant.split('<')[0].trim() || "(No Recipient)"}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {isSentSpace && email.isOpened && <span title={`Read at ${new Date(email.openedAt).toLocaleString()}`} style={{ color: '#0ea5e9', fontSize: '0.9rem', fontWeight: 700 }}>✓✓</span>}
                      {isSentSpace && email.isTracked && !email.isOpened && <span title="Sent & Tracked" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>✓</span>}
                      {activeAccountId === 'unified' && (() => {
                        const acct = accounts.find(a => a.id === email.accountId);
                        const label = acct ? acct.email.split('@')[1].split('.')[0] : null;
                        return label ? <span style={{ fontSize: '0.68rem', background: 'rgba(99,102,241,0.15)', color: 'var(--accent)', borderRadius: '4px', padding: '1px 5px', fontWeight: 600 }}>{label}</span> : null;
                      })()}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '400' }}>
                        {new Date(email.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontWeight: email.isUnread && !isSelected ? '600' : '400', color: email.isUnread && !isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {email.subject}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.8 }}>
                    {(email.preview || email.snippet || "").replace(/&quot;/g, '"')}
                  </div>
                </div>
              </div>
            );
          })}
          {nextPageToken && (
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={fetchMore}
                disabled={loadingMore}
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '10px 24px', borderRadius: '24px', cursor: loadingMore ? 'default' : 'pointer', fontSize: '0.9rem', opacity: loadingMore ? 0.6 : 1 }}
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
          </>
        )}
      </div>

      {/* Reading Pane / Draft Compose */}
      <div
        className={`mobile-full-pane ${!activeEmail ? 'mobile-hidden' : ''}`}
        style={{ flex: 1, height: '100%', overflowY: 'auto', background: 'var(--glass-bg)', position: 'relative' }}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (dx > 60) setActiveEmail(null); // swipe right to go back
          touchStartX.current = null;
        }}
      >
        {activeEmail?.isLoading ? (
          <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ width: '24px', height: '24px', marginRight: '8px' }}></div>
            Loading...
          </div>
        ) : activeEmail ? (
          space === "Drafts" ? (
            <ComposeModal 
              userEmail={activeEmail.from?.split('<')[1]?.replace('>', '') || "me"}
              initialDraftId={activeEmail.id}
              initialTo={activeEmail.to}
              initialSubject={activeEmail.subject}
              initialBody={activeEmail.threadMessages?.[activeEmail.threadMessages.length - 1]?.html || activeEmail.threadMessages?.[activeEmail.threadMessages.length - 1]?.text || ""}
              initialAttachments={activeEmail.attachments || []}
              contacts={contacts || []}
              isInline={true}
              onClose={(result) => {
                if (result) {
                  handleComposeClose(result);
                  setActiveEmail(null);
                } else {
                  setActiveEmail(null);
                  showToast("Draft Saved 💾");
                }
              }}
            />
          ) : (
          <div className="pop-in" style={{ padding: '32px 48px', width: '100%', margin: '0', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <button 
                className="mobile-only" 
                onClick={() => setActiveEmail(null)} 
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '8px 16px', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start' }}>
                <span>←</span> Back to Inbox
              </button>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const action = activeEmail.isStarred ? "UNSTAR" : "STAR";
                    setActiveEmail(prev => ({ ...prev, isStarred: !prev.isStarred }));
                    setEmails(prev => prev.map(m => m.id === activeEmail.id ? { ...m, isStarred: !m.isStarred } : m));
                    fetch("/api/gmail/star", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, messages: [{ id: activeEmail.id, accountId: activeEmail.accountId }] }) });
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1.8rem', color: activeEmail.isStarred ? '#fbbf24' : 'var(--text-secondary)', opacity: activeEmail.isStarred ? 1 : 0.5, marginTop: '2px' }}
                >
                  {activeEmail.isStarred ? '★' : '☆'}
                </button>
                <h2 style={{ fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>{activeEmail.subject}</h2>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--glass-border)', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setSnoozeMenuOpen(!snoozeMenuOpen)} className="thread-action-btn" style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer' }}>⏰ Snooze</button>
                    {snoozeMenuOpen && (
                       <div className="pop-in" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                         <button onClick={() => handleSnooze(activeEmail, "LATER_TODAY")} style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}>Later Today (6 PM)</button>
                         <button onClick={() => handleSnooze(activeEmail, "TOMORROW")} style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}>Tomorrow (8 AM)</button>
                         <button onClick={() => handleSnooze(activeEmail, "NEXT_WEEK")} style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}>Next Week (Mon 8 AM)</button>
                       </div>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => { if(!moveMenuOpen) fetchLabels(); setMoveMenuOpen(!moveMenuOpen); }} className="thread-action-btn" style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer' }}>📁 Move To</button>
                    {moveMenuOpen && (
                       <div className="pop-in" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', zIndex: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: '200px', maxHeight: '300px', overflowY: 'auto', zIndex: 20 }}>
                         {userLabels.map(l => (
                           <button key={l.id} onClick={() => handleMove(l.id)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}>{l.name}</button>
                         ))}
                         <form onSubmit={handleCreateLabel} style={{ padding: '8px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '4px' }}>
                           <input type="text" value={newLabelName} onChange={e => setNewLabelName(e.target.value)} placeholder="New label..." style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                           <button type="submit" disabled={creatingLabel} style={{ background: 'var(--text-primary)', color: 'var(--bg-color)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                         </form>
                       </div>
                    )}
                  </div>
                  <button 
                    onClick={async () => {
                      try {
                        await fetch("/api/gmail/trash", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ messages: [{ id: activeEmail.id, accountId: activeEmail.accountId }] })
                        });
                        showToast("Thread deleted");
                        setActiveEmail(null);
                        fetchInbox();
                      } catch (e) {
                        showToast("Error deleting thread");
                      }
                    }}
                    className="thread-action-btn"
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    🗑️ Delete
                  </button>
              </div>

              {/* Unsubscribe banner */}
              {activeEmail.threadMessages?.some(m => m.unsubscribeUrl) && (
                <div style={{ marginBottom: '16px', padding: '10px 16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>This is a mailing list email.</span>
                  <a
                    href={activeEmail.threadMessages.find(m => m.unsubscribeUrl)?.unsubscribeUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    Unsubscribe →
                  </a>
                </div>
              )}

              {/* In-thread search */}
              {activeEmail.threadMessages && activeEmail.threadMessages.length > 1 && (
                <div style={{ marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Search in thread…"
                    value={threadSearch}
                    onChange={e => setThreadSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 16px', borderRadius: '24px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.9rem' }}
                  />
                </div>
              )}

              {/* Thread Messages */}
              {activeEmail.threadMessages && activeEmail.threadMessages.filter(msg => {
                if (!threadSearch) return true;
                const q = threadSearch.toLowerCase();
                return (msg.from || '').toLowerCase().includes(q) || (msg.text || '').toLowerCase().includes(q) || (msg.subject || '').toLowerCase().includes(q);
              }).map((msg, index) => (
                <div key={msg.id} style={{ marginBottom: '24px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', overflow: 'hidden' }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{msg.from}</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>To: {msg.to}</div>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {msg.isOpened && <span title={`Read at ${new Date(msg.openedAt).toLocaleString()}`} style={{ color: '#0ea5e9', fontSize: '1.1rem', fontWeight: 700 }}>✓✓</span>}
                      {msg.isTracked && !msg.isOpened && <span title="Sent & Tracked" style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>✓</span>}
                      <span>{new Date(msg.date).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div style={{ background: '#ffffff' }}>
                    {msg.html ? (
                      <iframe
                        title={`msg-${msg.id}`}
                        srcDoc={`<!DOCTYPE html><html><head><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #000000 !important; background-color: #ffffff !important; padding: 24px; margin: 0; word-wrap: break-word; } a { color: #2563eb; text-decoration: none; } a:hover { text-decoration: underline; } img { max-width: 100%; height: auto; border-radius: 4px; } table, div, td { color: inherit; }</style></head><body>${msg.html}</body></html>`}
                        onLoad={(e) => {
                          try {
                            const doc = e.target.contentWindow.document;
                            const h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
                            e.target.style.height = `${h + 32}px`;
                          } catch {}
                        }}
                        style={{ width: '100%', height: '0', minHeight: '200px', border: 'none', background: '#ffffff', borderRadius: '0 0 14px 14px', display: 'block' }}
                      />
                    ) : (
                      <pre style={{ padding: '24px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: '#000', margin: 0, lineHeight: '1.6' }}>{msg.text}</pre>
                    )}
                  </div>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ padding: '16px', borderTop: '1px solid var(--glass-border)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {msg.attachments.map((att, i) => (
                          <a 
                            key={i}
                            href={`/api/gmail/attachment?messageId=${msg.id}&accountId=${msg.accountId}&id=${att.attachmentId}&filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType)}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '10px 16px',
                              background: 'var(--glass-bg)',
                              border: '1px solid var(--glass-border)',
                              borderRadius: '8px',
                              textDecoration: 'none',
                              color: 'var(--text-primary)',
                              fontSize: '0.9rem',
                              transition: 'all 0.2s'
                            }}
                          >
                            <span>📎</span>
                            <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.filename}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* AI Assistant — sits close to reply actions for context */}
              {activeEmail.threadMessages && activeEmail.threadMessages.length > 0 && (
                <div style={{ marginTop: '24px', marginBottom: '8px' }}>
                  <AIAssistant
                    emailContent={activeEmail.threadMessages.map(m => m.text || m.html?.replace(/<[^>]+>/g, '')).join('\n')}
                    onAction={(action, result) => {
                      if (action === 'reply') {
                        setComposeTo(activeEmail.from);
                        setComposeSubject(activeEmail.subject.startsWith('Re:') ? activeEmail.subject : `Re: ${activeEmail.subject}`);
                        setComposeBody(result);
                        setComposeOpen(true);
                      }
                    }}
                  />
                </div>
              )}

              {/* Reply/Forward actions */}
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => {
                    const lastMsg = activeEmail.threadMessages?.[activeEmail.threadMessages.length - 1] || activeEmail;
                    const to = lastMsg.from.match(/<(.*?)>/) ? lastMsg.from.match(/<(.*?)>/)[1] : lastMsg.from;
                    setComposeTo(to);
                    setComposeSubject(activeEmail.subject.startsWith('Re:') ? activeEmail.subject : `Re: ${activeEmail.subject}`);
                    setComposeBody('');
                    setComposeOpen(true);
                  }}
                  className="thread-action-btn"
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  ↩ Reply
                </button>
                <button
                  onClick={() => {
                    const lastMsg = activeEmail.threadMessages?.[activeEmail.threadMessages.length - 1] || activeEmail;
                    setComposeTo('');
                    setComposeSubject(activeEmail.subject.startsWith('Fwd:') ? activeEmail.subject : `Fwd: ${activeEmail.subject}`);
                    setComposeBody(`\n\n---------- Forwarded message ---------\nFrom: ${lastMsg.from}\nDate: ${lastMsg.date}\nSubject: ${lastMsg.subject}\nTo: ${lastMsg.to}\n\n${lastMsg.text || ''}`);
                    setComposeOpen(true);
                  }}
                  className="thread-action-btn"
                  style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '10px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  ↪ Forward
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '3rem', opacity: 0.2 }}>✉️</span>
            <p>Select a message to read</p>
          </div>
        )}
      </div>

      {/* Global Toast Notification */}
      {toast && (
        <div className="pop-in" style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--text-primary)',
          color: 'var(--bg-color)',
          padding: '12px 24px',
          borderRadius: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          fontWeight: '600',
          zIndex: 9999
        }}>
          {toast}
        </div>
      )}

      {undoToast && (
        <div className="pop-in" style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--text-primary)',
          color: 'var(--bg-color)',
          padding: '12px 24px',
          borderRadius: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          fontWeight: '600',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <span>{undoToast}</span>
          <button onClick={handleUndo} style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: 'none', padding: '4px 12px', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Undo</button>
        </div>
      )}

      <OnboardingModal />
      <CmdKPalette
        activeAccountId={activeAccountId}
        onSelectAccount={(id) => {
          window.location.href = `/inbox?account=${id}`;
        }}
      />

      {/* Global Reply / Compose Modal for Inbox Client */}
      {composeOpen && (
        <ComposeModal 
          userEmail={activeEmail?.to || "me"}
          initialAccountId={activeAccountId}
          initialTo={composeTo}
          initialSubject={composeSubject}
          initialBody={composeBody}
          initialAttachments={composeAttachments}
          contacts={contacts}
          onClose={handleComposeClose}
        />
      )}
    </div>
  );
}
