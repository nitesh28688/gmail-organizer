import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { sendEmail } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { accountId, ...body } = await req.json();
    const result = await sendEmail(session.user.id, accountId, body);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Failed to send email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
