import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { sendEmail } from "../../../../lib/gmail";
import { prisma } from "../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let { accountId, body, ...restBody } = await req.json();

    // Generate a unique tracking ID
    const trackingId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Inject the invisible pixel at the end of the body
    const trackingPixelUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/track?id=${trackingId}`;
    const pixelHtml = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" />`;
    
    // Append to body (assuming body is HTML)
    body = (body || "") + pixelHtml;

    const result = await sendEmail(session.user.id, accountId, { body, ...restBody });

    // Store tracking info in DB
    try {
      await prisma.emailTracking.create({
        data: {
          id: trackingId,
          messageId: result.id || trackingId,
          subject: restBody.subject || "(No Subject)",
          recipient: restBody.to || "",
          userId: session.user.id
        }
      });
    } catch(dbErr) {
      console.error("Failed to store tracking info", dbErr);
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Failed to send email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
