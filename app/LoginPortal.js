"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";

const FEATURES = [
  {
    icon: "🗂️",
    title: "Auto-organise your inbox",
    desc: "Choose from 10 preset categories — Finance, Newsletters, Orders, Social and more. Linear Mail labels and archives them across your entire email history in minutes."
  },
  {
    icon: "✨",
    title: "AI that actually reads your email",
    desc: "Summarise any thread in one click. Get smart reply suggestions. Rewrite your drafts with an inline AI toolbar. Powered by Google Gemini."
  },
  {
    icon: "✓✓",
    title: "Know when your email is read",
    desc: "Every email you send gets a silent read receipt. See double-ticks and exact open timestamps right in your Sent folder — no extensions required."
  },
  {
    icon: "⏰",
    title: "Send later & snooze anything",
    desc: "Schedule emails to send at the right moment. Snooze threads to reappear tomorrow morning, later today, or next week — then forget about them."
  },
  {
    icon: "📱",
    title: "Works on every device",
    desc: "A fully responsive interface built for desktop and mobile. Swipe to go back, tap-friendly action buttons, and a collapsible sidebar that stays out of your way."
  },
  {
    icon: "🔒",
    title: "Your email stays yours",
    desc: "Linear Mail never stores your email content. Everything is fetched from Gmail in real time and displayed directly to you — nothing sits on our servers."
  },
];

export default function LoginPortal() {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    signIn("google");
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#090a0f',
      color: '#f9fafb',
      fontFamily: 'Inter, sans-serif',
      overflowX: 'hidden',
    }}>
      {/* Ambient background */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50vw', height: '50vw', background: 'rgba(99,102,241,0.12)', filter: 'blur(120px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40vw', height: '40vw', background: 'rgba(16,185,129,0.08)', filter: 'blur(100px)', borderRadius: '50%' }} />
      </div>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(9,10,15,0.8)', backdropFilter: 'blur(16px)',
        padding: '0 48px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo-lv.png" alt="" style={{ width: '28px', height: '28px', objectFit: 'contain' }} onError={(e) => e.target.style.display='none'} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>Linear Mail</span>
        </div>
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            padding: '8px 20px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontWeight: 600, fontSize: '0.9rem',
            cursor: 'pointer', transition: 'all 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </nav>

      {/* Hero */}
      <section style={{
        position: 'relative', zIndex: 1,
        maxWidth: '760px', margin: '0 auto',
        padding: '100px 32px 80px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block', marginBottom: '24px',
          padding: '5px 14px', borderRadius: '20px',
          background: 'rgba(99,102,241,0.15)',
          border: '1px solid rgba(99,102,241,0.3)',
          fontSize: '0.82rem', fontWeight: 600,
          color: '#a5b4fc', letterSpacing: '0.04em',
          textTransform: 'uppercase'
        }}>
          By Linear Ventures
        </div>

        <h1 style={{
          fontSize: 'clamp(2.4rem, 6vw, 4rem)',
          fontWeight: 800, letterSpacing: '-0.04em',
          lineHeight: 1.1, marginBottom: '24px',
          background: 'linear-gradient(135deg, #ffffff 60%, #a5b4fc)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Linear Mail
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
          color: '#9ca3af', lineHeight: 1.7,
          marginBottom: '48px', maxWidth: '540px', margin: '0 auto 48px',
        }}>
          A smarter Gmail client. Organise your inbox with AI-powered rules, track email opens, schedule sends, and actually get to inbox zero.
        </p>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '12px',
            padding: '16px 36px', borderRadius: '14px',
            background: 'linear-gradient(to right, #ffffff, #f3f4f6)',
            color: '#111', fontWeight: 700, fontSize: '1.05rem',
            border: 'none', cursor: loading ? 'default' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 24px rgba(255,255,255,0.15)',
            opacity: loading ? 0.7 : 1,
          }}
          onMouseOver={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>

        <p style={{ marginTop: '16px', fontSize: '0.82rem', color: '#6b7280' }}>
          Free to use · No credit card required
        </p>
      </section>

      {/* Features */}
      <section style={{
        position: 'relative', zIndex: 1,
        maxWidth: '1100px', margin: '0 auto',
        padding: '40px 32px 100px',
      }}>
        <h2 style={{
          textAlign: 'center', fontSize: '1.6rem', fontWeight: 700,
          letterSpacing: '-0.02em', marginBottom: '48px', color: '#f9fafb',
        }}>
          Everything your inbox is missing
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              padding: '28px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              transition: 'border-color 0.2s',
            }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: '16px' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', color: '#f9fafb' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#9ca3af', lineHeight: 1.6, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center', padding: '0 32px 100px',
      }}>
        <div style={{
          display: 'inline-block', padding: '48px 64px',
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '24px',
        }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.02em' }}>
            Ready to take back your inbox?
          </h2>
          <p style={{ color: '#9ca3af', marginBottom: '32px', fontSize: '1rem' }}>
            Sign in with Google in seconds. Works with any Gmail account.
          </p>
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '12px',
              padding: '14px 32px', borderRadius: '12px',
              background: '#6366f1', color: '#fff',
              fontWeight: 700, fontSize: '1rem',
              border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#818cf8'}
            onMouseOut={e => e.currentTarget.style.background = '#6366f1'}
          >
            Get started free →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '24px 48px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '12px',
        fontSize: '0.85rem', color: '#6b7280',
      }}>
        <span>© 2026 Linear Ventures. All rights reserved.</span>
        <div style={{ display: 'flex', gap: '24px' }}>
          <Link href="/privacy" style={{ color: '#6b7280', textDecoration: 'none' }}
            onMouseOver={e => e.currentTarget.style.color = '#9ca3af'}
            onMouseOut={e => e.currentTarget.style.color = '#6b7280'}
          >
            Privacy Policy
          </Link>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{__html: `* { box-sizing: border-box; margin: 0; padding: 0; }`}} />
    </div>
  );
}
