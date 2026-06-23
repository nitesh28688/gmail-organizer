import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { performAuditChunk } from "../../../../lib/gmail";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { accountId, cursor } = await request.json();
    const result = await performAuditChunk(session.user.id, accountId, cursor ?? null);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Audit chunk error:", error);
    return NextResponse.json({ error: "Audit chunk failed" }, { status: 500 });
  }
}
