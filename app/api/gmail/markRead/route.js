import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { markAsRead } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    await markAsRead(session.user.id, messages);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark Read Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
