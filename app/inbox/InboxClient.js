"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ComposeModal from "./ComposeModal";

export default function InboxPage() {
  const searchParams = useSearchParams();
  const space = searchParams.get("space") || "All Mail";
  const activeAccountId = searchParams.get("account") || "";
  
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeEmail, setActiveEmail] = useState(null);
  const [loadingBody, setLoadingBody] = useState(false);
  
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

  // Toast State
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
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
    try {
      let baseQuery = "";
      if (space === "All Mail") baseQuery = "-in:trash";
      else if (space === "Drafts") baseQuery = "in:draft";
      else if (space === "Sent") baseQuery = "in:sent";
      else if (space === "Trash") baseQuery = "in:trash";
      else if (space === "Linear Ventures") baseQuery = "(to:linearventures.in OR from:linearventures.in) -in:trash -in:draft";
      else if (space === "Nanoliss") baseQuery = "(to:nanoliss.in OR from:nanoliss.in) -in:trash -in:draft";
      else if (space === "Services") baseQuery = "(receipt OR invoice OR order OR service) -in:trash -in:draft";
      else if (space === "Finance") baseQuery = "(bank OR statement OR payment OR finance) -in:trash -in:draft";
      else baseQuery = `(to:${space} OR from:${space}) -in:trash -in:draft`;

      let finalQuery = baseQuery;
      if (searchQuery) finalQuery += ` ${searchQuery}`;
      if (filterTo) finalQuery += ` to:${filterTo}`;
      if (filterFrom) finalQuery += ` from:${filterFrom}`;
      if (filterSubject) finalQuery += ` subject:${filterSubject}`;
      if (filterAttachment) finalQuery += ` has:attachment`;
      if (filterUnread) finalQuery += ` is:unread`;

      const res = await fetch(`/api/gmail/messages?q=${encodeURIComponent(finalQuery.trim())}&accountId=${activeAccountId}`);
      const data = await res.json();
      setEmails(data.emails || []);
      
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

  // Re-fetch when space or account changes
  useEffect(() => {
    setSearchQuery("");
    setFilterTo("");
    setFilterFrom("");
    setFilterSubject("");
    setFilterAttachment(false);
    setFilterUnread(false);
    fetchInbox();
  }, [space, activeAccountId]);

  // Immediate fetch when unread toggle changes
  useEffect(() => {
    fetchInbox();
  }, [filterUnread]);

  const selectEmail = async (emailId) => {
    setLoadingBody(true);
    try {
      const emailObj = emails.find(e => e.id === emailId);
      if (emailObj && emailObj.isUnread) {
        // Optimistically mark as read locally
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, isUnread: false } : e));
        fetch("/api/gmail/markRead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [{ id: emailId, accountId: emailObj.accountId }] })
        }).then(() => {
          window.dispatchEvent(new Event("refreshCounts"));
        }).catch(console.error);
      }

      const accountIdParam = emailObj ? `&accountId=${emailObj.accountId}` : '';
      const res = await fetch(`/api/gmail/message?id=${emailId}${accountIdParam}`);
      const data = await res.json();
      setActiveEmail(data.email);
    } catch (e) {
      console.error("Failed to load email body", e);
    } finally {
      setLoadingBody(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchInbox();
  };

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

  const isSentSpace = space === "Sent";
  const isDraftSpace = space === "Drafts";
  const isTrashSpace = space === "Trash";
  const allSelected = emails.length > 0 && selectedEmails.length === emails.length;

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
            </div>
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
          <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>No messages found.</div>
        ) : (
          emails.map(email => {
            const displayParticipant = isSentSpace || isDraftSpace ? `To: ${email.to}` : email.from;
            const isSelected = selectedEmails.includes(email.id);
            const isActive = activeEmail?.id === email.id;

            return (
              <div 
                key={email.id}
                onClick={() => selectEmail(email.id)}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: email.isUnread && !isSelected ? '700' : '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                      {displayParticipant.split('<')[0].trim() || "(No Recipient)"}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(email.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
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
          })
        )}
      </div>

      {/* Reading Pane / Draft Compose */}
      <div className={`mobile-full-pane ${!activeEmail ? 'mobile-hidden' : ''}`} style={{ flex: 1, height: '100%', overflowY: 'auto', background: 'var(--glass-bg)', position: 'relative' }}>
        {loadingBody ? (
          <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ width: '24px', height: '24px', marginRight: '8px' }}></div>
            Loading...
          </div>
        ) : activeEmail ? (
          isDraftSpace ? (
            <ComposeModal 
              userEmail={activeEmail.from?.split('<')[1]?.replace('>', '') || "me"}
              initialDraftId={activeEmail.id}
              initialTo={activeEmail.to}
              initialSubject={activeEmail.subject}
              initialBody={activeEmail.text || ""}
              initialAttachments={activeEmail.attachments || []}
              onClose={(sent) => {
                setActiveEmail(null);
                if (sent) {
                  showToast("Draft Sent Successfully! 🚀");
                  fetchInbox(); // Refresh list to remove sent draft
                } else {
                  showToast("Draft Saved 💾");
                }
              }}
            />
          ) : (
            <div className="pop-in" style={{ padding: '32px 48px', width: '100%', margin: '0', position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <button 
                className="mobile-only" 
                onClick={() => setActiveEmail(null)} 
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', padding: '8px 16px', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start' }}>
                <span>←</span> Back to Inbox
              </button>
              <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '8px' }}>{activeEmail.subject}</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--glass-border)' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{activeEmail.from}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>To: {activeEmail.to}</div>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {new Date(activeEmail.date).toLocaleString()}
                </div>
              </div>

              {/* Email Body */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
                <iframe 
                  title="Email Body"
                  srcDoc={`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <style>
                        body { 
                          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                          line-height: 1.6; 
                          color: #000000 !important; 
                          background-color: #ffffff !important;
                          padding: 24px;
                          margin: 0;
                          word-wrap: break-word;
                        }
                        a { color: #2563eb; text-decoration: none; }
                        a:hover { text-decoration: underline; }
                        img { max-width: 100%; height: auto; border-radius: 4px; }
                        
                        /* Force common containers to be readable */
                        table, div, td {
                          color: inherit;
                        }
                      </style>
                    </head>
                    <body>
                      ${activeEmail.html || activeEmail.text?.replace(/\n/g, '<br/>') || "No content"}
                    </body>
                    </html>
                  `}
                  style={{ 
                    width: '100%', 
                    flex: 1,
                    minHeight: '500px',
                    border: 'none', 
                    background: '#ffffff',
                  }}
                />
              </div>

              {/* Attachments */}
              {activeEmail.attachments && activeEmail.attachments.length > 0 && (
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--glass-border)' }}>
                  <h4 style={{ marginBottom: '16px', fontWeight: '600' }}>Attachments ({activeEmail.attachments.length})</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {activeEmail.attachments.map((att, i) => (
                      <a 
                        key={i}
                        href={`/api/gmail/attachment?messageId=${activeEmail.id}&accountId=${activeEmail.accountId}&id=${att.attachmentId}&filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType)}`}
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
                        onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'var(--glass-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
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
    </div>
  );
}
