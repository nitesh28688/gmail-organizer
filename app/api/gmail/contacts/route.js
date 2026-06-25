import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") || null;

  try {
    const gmail = await getGmailClient(session.user.id, accountId);

    // Fetch recent sent messages to extract contacts
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "in:sent",
      maxResults: 100,
    });

    const messages = res.data.messages || [];
    const contactMap = new Map();

    await Promise.all(messages.map(async (m) => {
      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: m.id,
          format: "metadata",
          metadataHeaders: ["To", "From"],
        });
        const headers = msg.data.payload?.headers || [];
        const getH = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        [getH("To"), getH("From")].forEach(raw => {
          if (!raw) return;
          // Handle comma-separated addresses
          raw.split(",").forEach(part => {
            part = part.trim();
            if (!part) return;
            const match = part.match(/^"?([^"<]+?)"?\s*<([^>]+)>$/);
            if (match) {
              const name = match[1].trim();
              const email = match[2].trim().toLowerCase();
              if (!contactMap.has(email)) {
                contactMap.set(email, `${name} <${email}>`);
              }
            } else if (part.includes("@")) {
              const email = part.toLowerCase();
              if (!contactMap.has(email)) {
                contactMap.set(email, email);
              }
            }
          });
        });
      } catch {}
    }));

    const contacts = Array.from(contactMap.values());
    return NextResponse.json({ contacts }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
    });
  } catch (error) {
    console.error("Contacts error:", error);
    return NextResponse.json({ contacts: [] });
  }
}
