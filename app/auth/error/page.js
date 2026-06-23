"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  let errorMessage = "An unknown error occurred.";
  if (error === "AccessDenied") {
    errorMessage = "You do not have permission to sign in to this application. This workspace is restricted to authorized personnel.";
  } else if (error === "Verification") {
    errorMessage = "The verification link has expired or has already been used.";
  } else if (error === "Configuration") {
    errorMessage = "There is a problem with the server configuration. Please ensure you have triggered a Redeploy in Vercel so the Google Client ID and Secret are loaded.";
  }

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
      {/* Dynamic Immersive Background (Red theme for error) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 0, opacity: 0.8 }}>
         <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', minWidth: '400px', minHeight: '400px', background: 'rgba(239, 68, 68, 0.15)', filter: 'blur(120px)', borderRadius: '50%', animation: 'float 20s ease-in-out infinite' }}></div>
         <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40vw', height: '40vw', minWidth: '300px', minHeight: '300px', background: 'rgba(239, 68, 68, 0.08)', filter: 'blur(100px)', borderRadius: '50%', animation: 'float 25s ease-in-out infinite reverse' }}></div>
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
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderTop: '4px solid #ef4444',
        borderRadius: '24px',
        padding: '3rem 2.5rem',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
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
          marginBottom: '0.75rem', 
          color: '#ef4444' 
        }}>
          Access Denied
        </h1>
        
        <p style={{ 
          color: '#9ca3af', 
          fontSize: '1rem', 
          lineHeight: '1.6', 
          marginBottom: '2.5rem',
          maxWidth: '320px'
        }}>
          {errorMessage}
        </p>

        <Link href="/" style={{ textDecoration: 'none', width: '100%' }}>
          <button 
            style={{ 
              width: "100%", 
              padding: "16px", 
              fontSize: "1.05rem", 
              borderRadius: "14px", 
              background: 'rgba(255,255,255,0.05)', 
              color: '#fff', 
              fontWeight: '600', 
              border: '1px solid rgba(255,255,255,0.1)',
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center", 
              gap: "12px",
              cursor: 'pointer', 
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseOver={(e) => { 
              e.currentTarget.style.transform = 'translateY(-2px)'; 
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseOut={(e) => { 
              e.currentTarget.style.transform = 'translateY(0)'; 
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
          >
            ← Return to Login
          </button>
        </Link>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
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

export default function AuthError() {
  return (
    <Suspense fallback={<div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090a0f', color: '#fff' }}>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
