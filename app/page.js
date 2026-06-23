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
    <div className="h-screen flex-center" style={{ 
      backgroundImage: "radial-gradient(circle at top right, rgba(74, 134, 232, 0.15), transparent 40%), radial-gradient(circle at bottom left, rgba(22, 167, 102, 0.1), transparent 40%)" 
    }}>
      <main className="glass-panel" style={{ padding: "4rem", maxWidth: "500px", width: "90%", textAlign: "center" }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <img 
            src="/logo-lv.png" 
            alt="Linear Ventures" 
            style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '16px', filter: 'drop-shadow(0 0 16px rgba(255,255,255,0.2))' }} 
            onError={(e) => e.target.style.display='none'} 
          />
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.02em', margin: '0 0 12px 0' }}>Gmail Organizer</h1>
          <p className="subtitle" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '80%', margin: '0 auto', lineHeight: '1.6' }}>
            Your premium, custom email client designed to segregate the noise and focus on what matters.
          </p>
        </div>

        {status === "loading" ? (
          <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
        ) : (
            <button 
              className="btn-primary" 
              onClick={() => signIn("google")}
              style={{ width: "100%", padding: "16px", fontSize: "1.1rem", borderRadius: "12px", boxShadow: "0 8px 32px rgba(99, 102, 241, 0.4)", display: "flex", justifyContent: "center", alignItems: "center", gap: "12px" }}
            >
              <div style={{ background: '#fff', borderRadius: '50%', padding: '4px', display: 'flex' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              Sign in with Google
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
