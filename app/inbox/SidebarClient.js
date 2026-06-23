"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import ComposeModal from "./ComposeModal";

export default function SidebarClient({ spaces, userEmail }) {
  const searchParams = useSearchParams();
  const currentSpace = searchParams.get("space") || "All Mail";
  const [isComposing, setIsComposing] = useState(false);
  const [expanded, setExpanded] = useState({ "Linear Ventures": false, "Nanoliss": false });
  const [counts, setCounts] = useState({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Theme Toggle State
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const handleToggle = () => setMobileOpen(o => !o);
    window.addEventListener("toggleSidebar", handleToggle);
    return () => window.removeEventListener("toggleSidebar", handleToggle);
  }, []);

  useEffect(() => {
    // Apply theme
    if (!isDarkMode) {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [isDarkMode]);

  useEffect(() => {
    let mounted = true;
    const fetchCounts = async () => {
      try {
        const res = await fetch("/api/gmail/counts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spaces }),
        });
        const data = await res.json();
        if (mounted && data.counts) {
          setCounts(data.counts);
          setIsLoadingCounts(false);
        }
      } catch (e) {
        console.error("Failed to fetch counts", e);
        if (mounted) setIsLoadingCounts(false);
      }
    };
    fetchCounts();
    return () => { mounted = false; };
  }, [spaces]);

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
          href={`/inbox?space=${encodeURIComponent(space.name)}`}
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
              <img src="/logo-nanoliss.png" alt="Nanoliss" width={16} height={16} style={{ objectFit: 'contain' }} onError={(e) => e.target.style.display='none'} />
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
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '8px' }}>Organizer</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{userEmail}</p>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}
            title="Toggle Theme"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

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
      
      <div style={{ marginTop: 'auto' }}>
        <Link href="/settings" style={{
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
        <ComposeModal onClose={() => setIsComposing(false)} userEmail={userEmail} />
      )}
    </>
  );
}
