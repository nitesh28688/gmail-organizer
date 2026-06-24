import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(request) {
  try {
    const body = await request.json();
    
    if (!body.message || !body.message.data) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8');
    const payload = JSON.parse(decodedData);

    const emailAddress = payload.emailAddress;
    const historyId = payload.historyId ? String(payload.historyId) : null;

    if (!emailAddress) {
       return NextResponse.json({ error: "No email address in payload" }, { status: 400 });
    }

    // Find all accounts that match this email address and update them
    // We update gmailPushAt so the client knows new mail arrived
    await prisma.account.updateMany({
      where: { gmailAddress: emailAddress },
      data: {
        gmailPushAt: new Date(),
        ...(historyId && { gmailHistoryId: historyId })
      }
    });

    console.log(`[Pub/Sub Webhook] Processed push notification for ${emailAddress}`);

    // Return 200 so Google knows we received it successfully
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Pub/Sub Webhook] Error processing push:", error);
    // Returning 200 even on error prevents Pub/Sub from infinitely retrying if it's an unparseable payload
    return NextResponse.json({ error: "Processing failed" }, { status: 200 });
  }
}
