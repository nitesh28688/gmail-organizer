import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// A 1x1 transparent GIF base64 string
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    try {
      // Mark as opened
      await prisma.emailTracking.update({
        where: { id },
        data: { opened: true, openedAt: new Date() }
      });
    } catch (error) {
      console.error("Failed to track email open", error);
      // Fail silently to not break the image load
    }
  }

  // Return the 1x1 transparent image with correct headers
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    }
  });
}
