import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { messageIds } = await request.json();
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ error: "No message IDs provided" }, { status: 400 });
    }

    const gmail = await getGmailClient(session.user.id);
    
    // Move to trash by adding the TRASH label
    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: {
        ids: messageIds,
        addLabelIds: ["TRASH"],
        removeLabelIds: ["INBOX"]
      }
    });

    return NextResponse.json({ success: true, count: messageIds.length });
  } catch (error) {
    console.error("Batch Trash Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
