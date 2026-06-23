import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getEmailBody } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Message ID required" }, { status: 400 });

  try {
    const email = await getEmailBody(session.user.id, id);
    return NextResponse.json({ email });
  } catch (error) {
    console.error("Fetch Email Body Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
