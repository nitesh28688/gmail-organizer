import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { accountId, executeAt, ...body } = await req.json();

    if (!executeAt) {
      return NextResponse.json({ error: "executeAt is required" }, { status: 400 });
    }

    const payload = JSON.stringify({ accountId, ...body });

    const task = await prisma.scheduledTask.create({
      data: {
        type: "SEND_LATER",
        executeAt: new Date(executeAt),
        payload,
        userId: session.user.id
      }
    });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("Failed to schedule email:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
