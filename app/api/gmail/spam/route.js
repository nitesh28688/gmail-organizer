import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const byAccount = {};
    for (const msg of messages) {
      if (!byAccount[msg.accountId]) byAccount[msg.accountId] = [];
      byAccount[msg.accountId].push(msg.id);
    }

    for (const [accountId, ids] of Object.entries(byAccount)) {
      const gmail = await getGmailClient(session.user.id, accountId);
      await gmail.users.messages.batchModify({
        userId: "me",
        requestBody: { ids, addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Spam Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
