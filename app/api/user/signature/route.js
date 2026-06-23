import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "../../../../lib/prisma";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    return NextResponse.json({ signature: user?.signature || "" });
  } catch (error) {
    console.error("Fetch Signature Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { signature } = await req.json();
    
    await prisma.user.update({
      where: { id: session.user.id },
      data: { signature }
    });

    return NextResponse.json({ success: true, signature });
  } catch (error) {
    console.error("Update Signature Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
