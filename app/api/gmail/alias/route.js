import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { addSendAsAlias } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, email } = await request.json();
    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const result = await addSendAsAlias(session.user.id, name, email);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Add Alias Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  try {
    const { getSendAsAliases } = require("../../../../lib/gmail");
    const aliases = await getSendAsAliases(session.user.id, accountId);
    return NextResponse.json({ aliases });
  } catch (error) {
    console.error("Get Aliases Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
