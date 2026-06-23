import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { getSidebarSpaces } from "../../lib/gmail";
import { redirect } from "next/navigation";
import SidebarClient from "./SidebarClient";

export default async function InboxLayout({ children }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect("/");
  }

  let spaces = [];
  try {
    spaces = await getSidebarSpaces(session.user.id);
  } catch (e) {
    console.error("Failed to load spaces:", e);
  }

  return (
    <div className="h-screen flex" style={{ display: 'flex', width: '100vw' }}>
      <SidebarClient spaces={spaces} userEmail={session.user.email} />

      {/* Main Content Area */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </main>
    </div>
  );
}
