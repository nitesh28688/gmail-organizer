import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { spaces, accountId } = await request.json();
    if (!spaces || !Array.isArray(spaces)) {
      return NextResponse.json({ error: "Invalid spaces payload" }, { status: 400 });
    }

    const gmail = await getGmailClient(session.user.id, accountId);

    // Fetch counts for all provided queries in parallel
    const fetchCount = async (query) => {
      let finalQuery = query === "in:draft" ? "in:draft" : `is:unread ${query}`;
      try {
        const res = await gmail.users.messages.list({
          userId: "me",
          q: finalQuery,
          maxResults: 100
        });
        
        if (!res.data.messages) return 0;
        if (res.data.nextPageToken) return "99+";
        
        return res.data.messages.length;
      } catch (e) {
        console.error("Error fetching count:", e.message);
        return 0;
      }
    };

    const results = {};
    await Promise.all(
      spaces.map(async (space) => {
        results[space.name] = await fetchCount(space.query);
        if (space.subSpaces) {
          await Promise.all(
            space.subSpaces.map(async (sub) => {
              results[sub.name] = await fetchCount(sub.query);
            })
          );
        }
      })
    );

    return NextResponse.json({ counts: results });
  } catch (error) {
    console.error("Counts API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
