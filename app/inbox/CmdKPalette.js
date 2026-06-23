"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function CmdKPalette({ activeAccountId, onSelectAccount }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const inputRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/gmail/accounts")
      .then(res => res.json())
      .then(data => {
        if (data.accounts) setAccounts(data.accounts);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const actions = [
    { id: "compose", label: "✍️ Compose Email", action: () => window.dispatchEvent(new Event("openCompose")) },
    { id: "unified", label: "📥 Unified Inbox", action: () => onSelectAccount("unified") },
    { id: "settings", label: "⚙️ Settings", action: () => router.push(`/settings?account=${activeAccountId}`) },
    ...accounts.map(acc => ({
      id: acc.id,
      label: `👤 Switch to ${acc.email}`,
      action: () => onSelectAccount(acc.id)
    }))
  ].filter(a => a.label.toLowerCase().includes(query.toLowerCase()));

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % actions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + actions.length) % actions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (actions[selectedIndex]) {
        actions[selectedIndex].action();
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', paddingTop: '15vh',
      zIndex: 9999
    }} onClick={() => setIsOpen(false)}>
      <div 
        style={{
          width: '500px', background: 'var(--bg-color)', border: '1px solid var(--glass-border)',
          borderRadius: '16px', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', maxHeight: '60vh'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '12px', opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            style={{
              width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)',
              fontSize: '1.2rem', outline: 'none'
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', padding: '8px' }}>
          {actions.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'center' }}>No commands found</div>
          ) : (
            actions.map((action, idx) => (
              <div
                key={action.id}
                onClick={() => { action.action(); setIsOpen(false); }}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: idx === selectedIndex ? 'var(--accent)' : 'transparent',
                  color: idx === selectedIndex ? '#fff' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {action.label}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
