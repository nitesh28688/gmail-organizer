import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { labelId, accountId } = await request.json();
    if (!labelId) return NextResponse.json({ error: "labelId required" }, { status: 400 });

    const gmail = await getGmailClient(session.user.id, accountId);
    let deleted = 0;
    let pageToken = null;

    do {
      const res = await gmail.users.messages.list({
        userId: "me",
        labelIds: [labelId],
        maxResults: 1000,
        ...(pageToken && { pageToken })
      });

      const messages = res.data.messages || [];
      if (messages.length > 0) {
        await gmail.users.messages.batchDelete({
          userId: "me",
          requestBody: { ids: messages.map(m => m.id) }
        });
        deleted += messages.length;
      }
      pageToken = res.data.nextPageToken || null;
    } while (pageToken);

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("Delete by label error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
