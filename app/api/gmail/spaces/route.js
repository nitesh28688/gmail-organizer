import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getSidebarSpaces } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  try {
    const spaces = await getSidebarSpaces(session.user.id, accountId);
    return NextResponse.json({ spaces });
  } catch (error) {
    console.error("Fetch Spaces Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
