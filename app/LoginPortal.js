"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPortal() {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    signIn("google");
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#090a0f',
      overflow: 'hidden',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Dynamic Immersive Background */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 0, opacity: 0.8 }}>
         <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', minWidth: '400px', minHeight: '400px', background: 'rgba(99, 102, 241, 0.15)', filter: 'blur(120px)', borderRadius: '50%', animation: 'float 20s ease-in-out infinite' }}></div>
         <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40vw', height: '40vw', minWidth: '300px', minHeight: '300px', background: 'rgba(16, 185, 129, 0.12)', filter: 'blur(100px)', borderRadius: '50%', animation: 'float 25s ease-in-out infinite reverse' }}></div>
         <div style={{ position: 'absolute', top: '40%', left: '60%', width: '30vw', height: '30vw', minWidth: '200px', minHeight: '200px', background: 'rgba(236, 72, 153, 0.08)', filter: 'blur(90px)', borderRadius: '50%', animation: 'float 15s ease-in-out infinite' }}></div>
      </div>

      {/* Central Glass Portal */}
      <main style={{
        position: 'relative',
        zIndex: 1,
        width: '90%',
        maxWidth: '440px',
        background: 'rgba(15, 17, 26, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '3rem 2.5rem',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        
        {/* Logo Container */}
        <div style={{
          width: '80px',
          height: '80px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '2rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
          <img 
            src="/logo-lv.png" 
            alt="Linear Ventures" 
            style={{ width: '50px', height: '50px', objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.2))' }} 
            onError={(e) => e.target.style.display='none'} 
          />
        </div>
        
        <h1 style={{
          fontSize: '2.2rem',
          fontWeight: '800',
          letterSpacing: '-0.03em',
          marginBottom: '0.5rem',
          color: '#fff'
        }}>
          Linear Mail
        </h1>

        <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          by Linear Ventures
        </p>

        <p style={{
          color: '#9ca3af',
          fontSize: '1.05rem',
          lineHeight: '1.5',
          marginBottom: '2.5rem',
          maxWidth: '300px'
        }}>
          A smarter Gmail client. Organise, summarise, and track your email.
        </p>

        {loading ? (
          <div style={{ width: '100%', height: '56px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            style={{ 
              width: "100%", 
              padding: "16px", 
              fontSize: "1.05rem", 
              borderRadius: "14px", 
              background: 'linear-gradient(to right, #ffffff, #f3f4f6)', 
              color: '#000', 
              fontWeight: '600', 
              border: 'none',
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center", 
              gap: "12px",
              cursor: 'pointer', 
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 14px 0 rgba(255,255,255,0.2)'
            }}
            onMouseOver={(e) => { 
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; 
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(255,255,255,0.3)' 
            }}
            onMouseOut={(e) => { 
              e.currentTarget.style.transform = 'translateY(0) scale(1)'; 
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(255,255,255,0.2)' 
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(1px) scale(0.98)';
            }}
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

        <div style={{ marginTop: '2.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '0.8rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          Strictly Authorized Access
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
        body { margin: 0 !important; overflow: hidden !important; }
      `}} />
    </div>
  );
}
