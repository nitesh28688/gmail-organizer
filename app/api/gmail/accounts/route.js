import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getConnectedAccounts } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const accounts = await getConnectedAccounts(session.user.id);
    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Fetch Accounts Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
