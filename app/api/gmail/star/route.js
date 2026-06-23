import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { starMessages, unstarMessages } from "../../../../lib/gmail";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messages, action } = await req.json(); // action is "STAR" or "UNSTAR"
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    if (action === "STAR") {
      await starMessages(session.user.id, messages);
    } else {
      await unstarMessages(session.user.id, messages);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update star status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
