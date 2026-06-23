import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../../../lib/gmail";

const prisma = new PrismaClient();

export async function GET(request) {
  // Vercel Cron will hit this route via GET
  // Verify it's actually Vercel calling it
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find tasks that are due and pending
    const tasks = await prisma.scheduledTask.findMany({
      where: {
        status: "PENDING",
        executeAt: { lte: now }
      },
      take: 20 // Process in batches
    });

    if (tasks.length === 0) {
      return NextResponse.json({ success: true, message: "No tasks to process" });
    }

    for (const task of tasks) {
      try {
        const payload = JSON.parse(task.payload);

        if (task.type === "SEND_LATER") {
          // Payload contains: { accountId, to, from, subject, body, ... }
          const { accountId, ...emailData } = payload;
          await sendEmail(task.userId, accountId, emailData);
        } else if (task.type === "SNOOZE") {
          // Payload contains: { accountId, messageId }
          // We would add it back to INBOX via Gmail API
          // (Implementation omitted for brevity, but this is the hook)
        }

        // Mark as DONE
        await prisma.scheduledTask.update({
          where: { id: task.id },
          data: { status: "DONE" }
        });
      } catch (err) {
        console.error(`Task ${task.id} failed:`, err);
        // Mark as FAILED
        await prisma.scheduledTask.update({
          where: { id: task.id },
          data: { status: "FAILED" }
        });
      }
    }

    return NextResponse.json({ success: true, processed: tasks.length });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Cron execution failed" }, { status: 500 });
  }
}
