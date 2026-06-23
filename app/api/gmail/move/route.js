import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { moveMessages } from "../../../../lib/gmail";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { messages, labelId } = await req.json();
    if (!messages || !Array.isArray(messages) || !labelId) {
      return NextResponse.json({ error: "messages array and labelId are required" }, { status: 400 });
    }

    await moveMessages(session.user.id, messages, labelId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to move messages:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
