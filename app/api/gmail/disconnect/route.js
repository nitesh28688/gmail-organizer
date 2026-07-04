import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId } = await request.json();
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: session.user.id },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  await prisma.account.delete({ where: { id: accountId } });

  const remaining = await prisma.account.count({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true, remaining });
}
