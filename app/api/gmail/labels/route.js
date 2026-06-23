import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "Account ID required" }, { status: 400 });

  try {
    const gmail = await getGmailClient(session.user.id, accountId);
    const res = await gmail.users.labels.list({ userId: "me" });
    // Filter out system labels if desired, or return all
    const userLabels = res.data.labels.filter(l => l.type === "user");
    return NextResponse.json({ labels: userLabels });
  } catch (error) {
    console.error("Fetch Labels Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { accountId, name } = await req.json();
    if (!accountId || !name) return NextResponse.json({ error: "accountId and name are required" }, { status: 400 });

    const gmail = await getGmailClient(session.user.id, accountId);
    const res = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show"
      }
    });

    return NextResponse.json({ label: res.data });
  } catch (error) {
    console.error("Create Label Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
