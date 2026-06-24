import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

// Maps sidebar space names to Gmail system label IDs
const LABEL_ID = {
  "Inbox":   "INBOX",
  "Starred": "STARRED",
  "Drafts":  "DRAFT",
  "Sent":    "SENT",
  "Spam":    "SPAM",
  "Trash":   "TRASH",
  "All Mail": "UNREAD", // use global unread count for All Mail
};

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { spaces, accountId } = await request.json();
    if (!spaces || !Array.isArray(spaces)) {
      return NextResponse.json({ error: "Invalid spaces payload" }, { status: 400 });
    }

    const gmail = await getGmailClient(session.user.id, accountId);
    const results = {};

    // Collect all spaces + subspaces to process
    const allSpaces = [];
    for (const space of spaces) {
      allSpaces.push(space);
      if (space.subSpaces) allSpaces.push(...space.subSpaces);
    }

    await Promise.all(allSpaces.map(async (space) => {
      const labelId = LABEL_ID[space.name];

      if (labelId) {
        // Exact count from Gmail system label API
        try {
          const res = await gmail.users.labels.get({ userId: "me", id: labelId });
          results[space.name] = space.name === "Drafts"
            ? (res.data.threadsTotal || 0)
            : (res.data.messagesUnread || 0);
        } catch {
          results[space.name] = 0;
        }
      } else if (space.labelId) {
        // Organizer/* label — show unread count, consistent with other spaces
        try {
          const res = await gmail.users.labels.get({ userId: "me", id: space.labelId });
          results[space.name] = res.data.messagesUnread || 0;
        } catch {
          results[space.name] = 0;
        }
      } else {
        // Custom query — fetch up to 500, exact if under, estimated if over
        try {
          const q = space.name === "Drafts" ? space.query : `is:unread ${space.query}`;
          const res = await gmail.users.messages.list({ userId: "me", q, maxResults: 500 });
          if (!res.data.messages) {
            results[space.name] = 0;
          } else if (res.data.nextPageToken) {
            // More than 500 — use Gmail's estimate
            results[space.name] = res.data.resultSizeEstimate || "500+";
          } else {
            results[space.name] = res.data.messages.length;
          }
        } catch {
          results[space.name] = 0;
        }
      }
    }));

    return NextResponse.json({ counts: results });
  } catch (error) {
    console.error("Counts API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
