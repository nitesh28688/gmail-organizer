"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  let errorMessage = "An unknown error occurred.";
  if (error === "AccessDenied") {
    errorMessage = "You do not have permission to sign in to this application. This workspace is restricted to authorized Linear Ventures personnel.";
  } else if (error === "Verification") {
    errorMessage = "The verification link has expired or has already been used.";
  } else if (error === "Configuration") {
    errorMessage = "There is a problem with the server configuration. Please contact your administrator.";
  }

  return (
    <div className="h-screen flex-center" style={{ 
      backgroundImage: "radial-gradient(circle at top right, rgba(239, 68, 68, 0.15), transparent 40%), radial-gradient(circle at bottom left, rgba(74, 134, 232, 0.1), transparent 40%)" 
    }}>
      <main className="glass-panel pop-in" style={{ padding: "4rem", maxWidth: "500px", width: "90%", textAlign: "center", borderTop: "4px solid #ef4444" }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <img 
            src="/logo-lv.png" 
            alt="Linear Ventures" 
            style={{ width: '60px', height: '60px', objectFit: 'contain', marginBottom: '24px', filter: 'drop-shadow(0 0 16px rgba(255,255,255,0.2))' }} 
            onError={(e) => e.target.style.display='none'} 
          />
          <h1 style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.02em', margin: '0 0 12px 0', color: '#ef4444' }}>Access Denied</h1>
          <p className="subtitle" style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '90%', margin: '0 auto', lineHeight: '1.6' }}>
            {errorMessage}
          </p>
        </div>

        <Link href="/" style={{ textDecoration: 'none' }}>
          <button 
            className="btn-primary" 
            style={{ width: "100%", padding: "14px", fontSize: "1rem", borderRadius: "12px", background: "var(--glass-border)", color: "var(--text-primary)" }}
          >
            ← Return to Login
          </button>
        </Link>
      </main>
    </div>
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={<div className="h-screen flex-center">Loading...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
