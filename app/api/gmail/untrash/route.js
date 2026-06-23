import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { untrashMessages } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    await untrashMessages(session.user.id, messages);

    return NextResponse.json({ success: true, count: messages.length });
  } catch (error) {
    console.error("Batch Untrash Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

