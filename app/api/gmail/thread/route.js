import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getThread } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");
  const accountId = searchParams.get("accountId");

  if (!threadId) return NextResponse.json({ error: "Thread ID required" }, { status: 400 });
  if (!accountId) return NextResponse.json({ error: "Account ID required" }, { status: 400 });

  try {
    const threadMessages = await getThread(session.user.id, accountId, threadId);
    return NextResponse.json({ messages: threadMessages }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
    });
  } catch (error) {
    console.error("Fetch Thread Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
