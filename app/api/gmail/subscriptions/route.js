import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  try {
    const gmail = await getGmailClient(session.user.id, accountId);

    const res = await gmail.users.messages.list({
      userId: "me",
      q: 'label:"Organizer/Newsletters"',
      maxResults: 200
    });

    const messages = res.data.messages || [];
    const subscriptions = new Map();

    await Promise.all(messages.map(async (msg) => {
      try {
        const detail = await gmail.users.messages.get({
          userId: "me", id: msg.id,
          format: "metadata",
          metadataHeaders: ["From", "List-Unsubscribe"]
        });

        const headers = detail.data.payload?.headers || [];
        const getH = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        const from = getH("From");
        const listUnsub = getH("List-Unsubscribe");
        if (!from || !listUnsub) return;

        const urlMatch = listUnsub.match(/<(https?:\/\/[^>]+)>/) || listUnsub.match(/(https?:\/\/[^\s,>]+)/);
        const unsubscribeUrl = urlMatch ? urlMatch[1] : null;
        if (!unsubscribeUrl) return;

        const nameMatch = from.match(/^"?([^"<]+)"?\s*<(.+)>$/);
        const name = nameMatch ? nameMatch[1].trim() : from;
        const email = nameMatch ? nameMatch[2].trim() : from;

        if (!subscriptions.has(email)) {
          subscriptions.set(email, { name, email, unsubscribeUrl, count: 0 });
        }
        subscriptions.get(email).count++;
      } catch {}
    }));

    const result = Array.from(subscriptions.values())
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ subscriptions: result });
  } catch (error) {
    console.error("Subscriptions error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
