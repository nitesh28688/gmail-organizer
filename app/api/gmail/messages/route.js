import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { fetchEmails } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const accountId = searchParams.get("accountId") || null;
  const pageToken = searchParams.get("pageToken") || null;

  try {
    const { emails, nextPageToken } = await fetchEmails(session.user.id, accountId, q, pageToken);
    return NextResponse.json({ emails, nextPageToken });
  } catch (error) {
    console.error("Fetch Emails Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
