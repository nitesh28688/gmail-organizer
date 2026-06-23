import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { getGmailClient } from "../../../../lib/gmail";
import { NextResponse } from "next/server";

const encodeEmail = ({ to, from, subject, body, attachments = [] }) => {
  const boundary = `----=_Part_${Math.random().toString(36).substring(2)}`;
  let str = "";
  if (attachments.length > 0) {
    str += `Content-Type: multipart/mixed; boundary="${boundary}"\n`;
    str += `MIME-Version: 1.0\n`;
    str += `to: ${to}\n`;
    str += `from: ${from}\n`;
    str += `subject: ${subject}\n\n`;
    
    str += `--${boundary}\n`;
    str += `Content-Type: text/plain; charset="UTF-8"\n`;
    str += `Content-Transfer-Encoding: 7bit\n\n`;
    str += `${body}\n\n`;
    
    for (const att of attachments) {
      str += `--${boundary}\n`;
      str += `Content-Type: ${att.mimeType}; name="${att.filename}"\n`;
      str += `Content-Disposition: attachment; filename="${att.filename}"\n`;
      str += `Content-Transfer-Encoding: base64\n\n`;
      const b64 = att.data.replace(/(.{76})/g, "$1\n");
      str += `${b64}\n\n`;
    }
    str += `--${boundary}--\n`;
  } else {
    str += `Content-Type: text/plain; charset="UTF-8"\n`;
    str += `MIME-Version: 1.0\n`;
    str += `Content-Transfer-Encoding: 7bit\n`;
    str += `to: ${to}\n`;
    str += `from: ${from}\n`;
    str += `subject: ${subject}\n\n`;
    str += body;
  }

  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = await request.json();
    const { draftId, to, from, subject, body, attachments } = payload;
    
    const gmail = await getGmailClient(session.user.id);
    const raw = encodeEmail({ to, from, subject, body, attachments });

    if (draftId) {
      const res = await gmail.users.drafts.update({
        userId: "me",
        id: draftId,
        requestBody: { message: { raw } },
      });
      return NextResponse.json({ draftId: res.data.id });
    } else {
      const res = await gmail.users.drafts.create({
        userId: "me",
        requestBody: { message: { raw } },
      });
      return NextResponse.json({ draftId: res.data.id });
    }
  } catch (error) {
    console.error("Draft Save Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { draftId } = await request.json();
    if (!draftId) return NextResponse.json({ error: "Missing draftId" }, { status: 400 });

    const gmail = await getGmailClient(session.user.id);
    await gmail.users.drafts.delete({ userId: "me", id: draftId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Draft Delete Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
