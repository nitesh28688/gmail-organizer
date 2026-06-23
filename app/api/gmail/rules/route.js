import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await prisma.auditRule.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" }
  });
  return NextResponse.json({ rules });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, query, labelName, archive = false, markRead = false } = await request.json();
  if (!name || !query || !labelName) {
    return NextResponse.json({ error: "name, query, and labelName are required" }, { status: 400 });
  }

  const rule = await prisma.auditRule.create({
    data: { name, query, labelName, archive, markRead, enabled: true, userId: session.user.id }
  });
  return NextResponse.json({ rule });
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, enabled, name, query, labelName, archive, markRead } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.auditRule.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rule = await prisma.auditRule.update({
    where: { id },
    data: {
      ...(enabled !== undefined && { enabled }),
      ...(name !== undefined && { name }),
      ...(query !== undefined && { query }),
      ...(labelName !== undefined && { labelName }),
      ...(archive !== undefined && { archive }),
      ...(markRead !== undefined && { markRead }),
    }
  });
  return NextResponse.json({ rule });
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.auditRule.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.auditRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
