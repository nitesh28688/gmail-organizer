import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { sendEmail, unsnoozeMessages, getGmailClient } from "../../../lib/gmail";

export async function GET(request) {
  // Vercel Cron will hit this route via GET
  // Verify it's actually Vercel calling it
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 1. Process Scheduled Tasks
    const tasks = await prisma.scheduledTask.findMany({
      where: {
        status: "PENDING",
        executeAt: { lte: now }
      },
      take: 20 // Process in batches
    });

    let processedTasks = 0;
    for (const task of tasks) {
      try {
        const payload = JSON.parse(task.payload);

        if (task.type === "SEND_LATER") {
          const { accountId, ...emailData } = payload;
          await sendEmail(task.userId, accountId, emailData);
        } else if (task.type === "SNOOZE") {
          const { accountId, messageId } = payload;
          await unsnoozeMessages(task.userId, [{ id: messageId, accountId }]);
        }

        await prisma.scheduledTask.update({
          where: { id: task.id },
          data: { status: "DONE" }
        });
        processedTasks++;
      } catch (err) {
        console.error(`Task ${task.id} failed:`, err);
        await prisma.scheduledTask.update({
          where: { id: task.id },
          data: { status: "FAILED" }
        });
      }
    }

    // 2. Process Gmail Watch Renewals
    let watchesRenewed = 0;
    if (process.env.PUBSUB_TOPIC_NAME) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const accountsToWatch = await prisma.account.findMany({
        where: {
          provider: "google",
          OR: [
            { gmailWatchExpiry: null },
            { gmailWatchExpiry: { lt: tomorrow } }
          ]
        },
        take: 10 // Batch to avoid hitting API limits
      });

      for (const account of accountsToWatch) {
        try {
          const gmail = await getGmailClient(account.userId, account.id);
          const profileRes = await gmail.users.getProfile({ userId: 'me' });
          const emailAddress = profileRes.data.emailAddress;

          await gmail.users.watch({
            userId: 'me',
            requestBody: {
              topicName: process.env.PUBSUB_TOPIC_NAME,
              labelIds: ['INBOX']
            }
          });

          // Watches expire in 7 days, so we set our DB expiry to 6 days
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + 6);

          await prisma.account.update({
            where: { id: account.id },
            data: {
              gmailAddress: emailAddress,
              gmailWatchExpiry: expiry
            }
          });
          watchesRenewed++;
        } catch (err) {
          console.error(`Failed to renew watch for account ${account.id}:`, err);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      processedTasks, 
      watchesRenewed 
    });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Cron execution failed" }, { status: 500 });
  }
}
