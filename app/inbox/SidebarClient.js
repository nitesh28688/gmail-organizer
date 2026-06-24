"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ComposeModal from "./ComposeModal";
import { signOut, signIn } from "next-auth/react";

export default function SidebarClient({ userEmail }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const currentSpace = searchParams.get("space") || "All Mail";
  const activeAccountId = searchParams.get("account") || "";

  const [accounts, setAccounts] = useState([]);
  const [spaces, setSpaces] = useState([]);
  
  const [isComposing, setIsComposing] = useState(false);
  const [expanded, setExpanded] = useState({ "Linear Ventures": false, "Nanoliss": false });
  const [counts, setCounts] = useState({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const handleToggle = () => setMobileOpen(o => !o);
    window.addEventListener("toggleSidebar", handleToggle);
    
    // Initialize theme from local storage
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "light") {
        setIsDarkMode(false);
      }
    }
    
    return () => window.removeEventListener("toggleSidebar", handleToggle);
  }, []);

  useEffect(() => {
    if (!isDarkMode) {
      document.body.classList.add('light-mode');
      localStorage.setItem("theme", "light");
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem("theme", "dark");
    }
  }, [isDarkMode]);

  // Fetch accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      const res = await fetch("/api/gmail/accounts");
      const data = await res.json();
      if (data.accounts && data.accounts.length > 0) {
        setAccounts(data.accounts);
        if (!activeAccountId) {
          router.replace(`?account=${data.accounts[0].id}`);
        }
      }
    };
    fetchAccounts();
  }, [activeAccountId, router]);

  // Fetch spaces when account changes
  useEffect(() => {
    if (!activeAccountId) return;
    const fetchSpaces = async () => {
      const res = await fetch(`/api/gmail/spaces?accountId=${activeAccountId}`);
      const data = await res.json();
      if (data.spaces) {
        setSpaces(data.spaces);
      }
    };
    fetchSpaces();
  }, [activeAccountId]);

  const fetchCounts = async () => {
    if (!activeAccountId || spaces.length === 0) return;
    setIsLoadingCounts(true);
    try {
      const res = await fetch("/api/gmail/counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaces, accountId: activeAccountId }),
      });
      const data = await res.json();
      if (data.counts) {
        setCounts(data.counts);
      }
    } catch (e) {
      console.error("Failed to fetch counts", e);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    const handleRefresh = () => fetchCounts();
    window.addEventListener("refreshCounts", handleRefresh);
    return () => window.removeEventListener("refreshCounts", handleRefresh);
  }, [spaces, activeAccountId]);

  const handleAccountChange = (e) => {
    router.push(`?account=${e.target.value}`);
  };

  const toggle = (e, name) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const renderSpace = (space, isSub = false) => {
    const isActive = currentSpace === space.name;
    const hasSub = space.subSpaces && space.subSpaces.length > 0;
    const isExpanded = expanded[space.name];
    const unread = counts[space.name] || 0;

    return (
      <div key={space.name}>
        <Link 
          href={`/inbox?space=${encodeURIComponent(space.name)}&account=${activeAccountId}${space.labelId ? `&labelId=${space.labelId}` : ''}`}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isSub ? '8px 12px 8px 36px' : '10px 12px',
            borderRadius: '8px',
            textDecoration: 'none',
            color: isActive ? 'var(--text-primary)' : (isSub ? 'var(--text-secondary)' : 'var(--text-primary)'),
            background: isActive ? 'var(--glass-border)' : 'transparent',
            fontWeight: isActive ? '600' : '500',
            transition: 'background 0.2s',
            fontSize: isSub ? '0.85rem' : '1rem'
          }}
          className="space-link"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasSub && (
              <span 
                onClick={(e) => toggle(e, space.name)}
                style={{ cursor: 'pointer', display: 'inline-block', width: '16px', fontSize: '0.8rem', opacity: 0.7 }}
              >
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            {!isSub && space.name === "Linear Ventures" && (
              <img src="/logo-lv.png" alt="LV" width={16} height={16} style={{ objectFit: 'contain' }} onError={(e) => e.target.style.display='none'} />
            )}
            {!isSub && space.name === "Nanoliss" && (
              <img className="logo-invert" src="/logo-nanoliss.png" alt="Nanoliss" width={16} height={16} style={{ objectFit: 'contain' }} onError={(e) => e.target.style.display='none'} />
            )}
            <span>{space.name}</span>
          </div>
          {isLoadingCounts ? (
            <div className="spinner" style={{ width: '12px', height: '12px', opacity: 0.5 }}></div>
          ) : unread !== 0 ? (
            <span style={{
              background: isActive ? 'var(--text-primary)' : 'var(--accent)',
              color: 'var(--bg-color)',
              fontSize: '0.75rem',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              {unread}
            </span>
          ) : null}
        </Link>
        {hasSub && isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
            {space.subSpaces.map(sub => renderSpace(sub, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div 
        className={`mobile-overlay ${mobileOpen ? 'open' : ''} mobile-only`} 
        onClick={() => setMobileOpen(false)} 
      />
      <aside className={`glass-panel mobile-drawer ${mobileOpen ? 'open' : ''}`} style={{ 
        height: '100%', 
        borderLeft: 'none', 
        borderTop: 'none', 
        borderBottom: 'none', 
        borderRadius: 0,
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        <div style={{ padding: '0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '8px' }}>Linear Mail</h2>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}
            title="Toggle Theme"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {accounts.length > 0 && (
          <div style={{ padding: '0 12px', position: 'relative' }}>
            <select
              value={activeAccountId}
              onChange={handleAccountChange}
              style={{
                width: '100%',
                padding: '10px 40px 10px 14px',
                borderRadius: '12px',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '0.95rem',
                fontWeight: '600',
                appearance: 'none',
                cursor: 'pointer',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
              }}
              onMouseOver={(e) => { e.target.style.borderColor = 'var(--text-primary)'; e.target.style.background = 'rgba(255, 255, 255, 0.08)' }}
              onMouseOut={(e) => { e.target.style.borderColor = 'var(--glass-border)'; e.target.style.background = 'var(--glass-bg)' }}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id} style={{ background: 'var(--bg-color)', color: 'var(--text-primary)' }}>{acc.email}</option>
              ))}
              <option value="unified" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)' }}>All Accounts (Unified)</option>
            </select>
            <div style={{ position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.7 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        )}

        <button 
          className="btn-primary" 
          onClick={() => setIsComposing(true)}
          style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
        >
          + Compose
        </button>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {spaces.map((space) => renderSpace(space))}
        </nav>
      </div>
      
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={() => signIn("google")}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass-border)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
        >
          ➕ Add Account
        </button>
        <button
          onClick={() => signOut()}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass-border)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
        >
          🚪 Sign Out
        </button>
        <Link href={`/settings?account=${activeAccountId}`} style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          borderRadius: '8px',
          textDecoration: 'none',
          color: 'var(--text-secondary)',
        }}>
           ⚙️ Settings & Rules
        </Link>
      </div>

      <style>{`
        .space-link:hover {
          background-color: var(--glass-border) !important;
        }
        .spinner {
          border: 2px solid rgba(255,255,255,0.1);
          border-left-color: var(--text-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
      </aside>

      {isComposing && (
        <ComposeModal onClose={() => setIsComposing(false)} userEmail={accounts.find(a => a.id === activeAccountId)?.email || userEmail} initialAccountId={activeAccountId} />
      )}
    </>
  );
}
