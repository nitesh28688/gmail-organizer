import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const messageId = url.searchParams.get("messageId");
  const attachmentId = url.searchParams.get("id");
  const accountId = url.searchParams.get("accountId");
  const mimeType = url.searchParams.get("mimeType") || "application/octet-stream";
  const filename = url.searchParams.get("filename") || "attachment";

  if (!messageId || !attachmentId || !accountId) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  try {
    const gmail = await getGmailClient(session.user.id, accountId);
    const res = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });

    const data = res.data.data;
    if (!data) return new NextResponse("Not Found", { status: 404 });

    const buffer = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Attachment fetch error:", error);
    return new NextResponse(error.message, { status: 500 });
  }
}
