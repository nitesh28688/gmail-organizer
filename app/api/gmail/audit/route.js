import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { performAudit } from "../../../../lib/gmail";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { accountId } = await request.json();
    // We intentionally don't await this if it's going to take a long time,
    // but Vercel serverless functions will kill the process if we don't await it.
    // Given the batch size and limits, we'll await it and hope it completes within the function timeout,
    // or the user can click it multiple times to resume.
    await performAudit(session.user.id, accountId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Audit error:", error);
    return NextResponse.json({ error: "Failed to perform audit" }, { status: 500 });
  }
}
