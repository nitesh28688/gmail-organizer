import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const accounts = await prisma.account.findMany({
      where: { userId: session.user.id }
    });

    // Find the latest push timestamp across all connected accounts
    let lastPushAt = null;
    for (const acc of accounts) {
      if (acc.gmailPushAt) {
        if (!lastPushAt || acc.gmailPushAt > lastPushAt) {
          lastPushAt = acc.gmailPushAt;
        }
      }
    }

    return NextResponse.json({ lastPushAt }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
    });
  } catch (error) {
    console.error("Ping Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
