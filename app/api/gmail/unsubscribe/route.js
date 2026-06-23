import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { sendEmail } from "../../../../lib/gmail";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { url, accountId } = await request.json();
    if (!url || !accountId) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    if (url.startsWith("mailto:")) {
      const emailAddress = url.replace("mailto:", "").split('?')[0];
      await sendEmail(session.user.id, accountId, {
        to: emailAddress,
        from: session.user.email,
        subject: "Unsubscribe",
        body: "Please unsubscribe me from this list."
      });
      return NextResponse.json({ success: true, method: "email" });
    } else if (url.startsWith("http")) {
      // For HTTP links, we just make a POST or GET request
      // Ideally it's a POST, but a GET might be required for some old systems
      try {
        await fetch(url, { method: "POST" });
      } catch(e) {
        // Fallback to GET if POST fails
        await fetch(url, { method: "GET" });
      }
      return NextResponse.json({ success: true, method: "http" });
    }

    return NextResponse.json({ error: "Invalid unsubscribe format" }, { status: 400 });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
