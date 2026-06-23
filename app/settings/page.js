import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Link from "next/link";
import SettingsButtons from "./SettingsButtons";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");

  return (
    <div className="h-screen flex" style={{ display: 'flex', width: '100vw' }}>
      {/* Sidebar */}
      <aside className="glass-panel" style={{ width: '280px', height: '100%', borderRadius: 0, padding: '24px 16px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '24px', padding: '0 12px' }}>Settings</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Link href="/inbox" style={{ padding: '10px 12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            ← Back to Inbox
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '48px', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '32px' }}>Rules Engine & Audit</h1>
        <SettingsButtons />
      </main>
    </div>
  );
}
