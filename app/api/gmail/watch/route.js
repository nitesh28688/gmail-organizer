import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";
import { prisma } from "../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const topicName = process.env.PUBSUB_TOPIC_NAME;
  if (!topicName) return NextResponse.json({ error: "PUBSUB_TOPIC_NAME not configured" }, { status: 500 });

  const { accountId } = await request.json();

  try {
    const gmail = await getGmailClient(session.user.id, accountId);
    const profile = await gmail.users.getProfile({ userId: "me" });
    const emailAddress = profile.data.emailAddress;

    const res = await gmail.users.watch({
      userId: "me",
      requestBody: { topicName, labelIds: ["INBOX"] }
    });

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 6);

    await prisma.account.update({
      where: { id: accountId },
      data: { gmailAddress: emailAddress, gmailWatchExpiry: expiry, gmailHistoryId: String(res.data.historyId) }
    });

    return NextResponse.json({ ok: true, emailAddress, historyId: res.data.historyId });
  } catch (e) {
    console.error("Watch setup failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
