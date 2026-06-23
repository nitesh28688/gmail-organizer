"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/inbox");
    }
  }, [status, router]);

  return (
    <div className="h-screen w-full flex" style={{ backgroundColor: '#090a0f', overflow: 'hidden' }}>
      {/* Left Column: Visual/Vibe */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '4rem',
        background: 'radial-gradient(circle at top left, rgba(79, 70, 229, 0.15) 0%, transparent 50%), radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.1) 0%, transparent 50%)',
      }} className="mobile-hidden">
        
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 0, opacity: 0.6 }}>
           <div style={{ position: 'absolute', top: '20%', left: '10%', width: '400px', height: '400px', background: 'rgba(99, 102, 241, 0.2)', filter: 'blur(100px)', borderRadius: '50%' }}></div>
           <div style={{ position: 'absolute', bottom: '10%', right: '20%', width: '300px', height: '300px', background: 'rgba(16, 185, 129, 0.15)', filter: 'blur(80px)', borderRadius: '50%' }}></div>
        </div>

        <div style={{ zIndex: 1, maxWidth: '600px' }}>
          <h1 style={{ fontSize: '4rem', fontWeight: '800', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: '1.5rem', background: 'linear-gradient(to right, #fff, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Focus on what truly matters.
          </h1>
          <p style={{ fontSize: '1.25rem', color: '#9ca3af', lineHeight: 1.6, marginBottom: '3rem', maxWidth: '480px' }}>
            A bespoke, lightning-fast mail client built exclusively for Linear Ventures. Segregate noise and accelerate your workflow.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem', color: '#fff' }}>10x</h3>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>Faster triage</p>
            </div>
            <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem', color: '#fff' }}>0</h3>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>Distractions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Login */}
      <div style={{
        flex: '0 0 480px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(10px)'
      }} className="mobile-full-pane">
        
        <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img 
            src="/logo-lv.png" 
            alt="Linear Ventures" 
            style={{ width: '64px', height: '64px', objectFit: 'contain', marginBottom: '2rem', filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.15))' }} 
            onError={(e) => e.target.style.display='none'} 
          />
          
          <h2 style={{ fontSize: '1.75rem', fontWeight: '600', marginBottom: '0.5rem', color: '#fff' }}>Welcome back</h2>
          <p style={{ color: '#9ca3af', marginBottom: '2.5rem', textAlign: 'center', fontSize: '0.95rem' }}>
            Sign in to access your workspace
          </p>

          {status === "loading" ? (
            <div style={{ width: '100%', height: '56px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="loader" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <button 
              className="btn-primary" 
              onClick={() => signIn("google")}
              style={{ 
                width: "100%", padding: "16px", fontSize: "1.05rem", borderRadius: "12px", 
                background: '#fff', color: '#000', fontWeight: '600', border: 'none',
                display: "flex", justifyContent: "center", alignItems: "center", gap: "12px",
                cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 14px 0 rgba(255,255,255,0.2)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,255,255,0.25)' }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(255,255,255,0.2)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          )}

          <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#6b7280' }}>
            Restricted to authorized personnel only.
          </p>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .mobile-hidden { display: none !important; }
          .mobile-full-pane { flex: 1 !important; border-left: none !important; }
        }
      `}} />
    </div>
  );
}
