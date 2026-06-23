import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SidebarClient from "./SidebarClient";

export const metadata = {
  title: "Inbox - Gmail Organizer",
};

export default async function InboxLayout({ children }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/");
  }

  return (
    <div className="h-screen flex" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Suspense fallback={<div style={{ width: '280px', height: '100%', background: 'var(--bg-surface)' }}>Loading...</div>}>
        <SidebarClient userEmail={session.user.email} />
      </Suspense>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>Loading inbox...</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
