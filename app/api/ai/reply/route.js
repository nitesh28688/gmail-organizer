import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { emailContent } = await request.json();
    if (!emailContent) return NextResponse.json({ error: "No content provided" }, { status: 400 });

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        replies: [
          "I will get back to you shortly.",
          "Thanks for reaching out!",
          "Can we discuss this later?"
        ] 
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Generate 3 short, realistic, and distinct quick reply options for this email. Return ONLY a JSON array of 3 strings (e.g. ["Yes, sounds good.", "No, thanks.", "Let's discuss next week."]). Email content:\n\n${emailContent.substring(0, 3000)}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    // Parse the JSON array from the response
    let replies = [];
    try {
      const jsonStart = text.indexOf('[');
      const jsonEnd = text.lastIndexOf(']') + 1;
      const jsonStr = text.substring(jsonStart, jsonEnd);
      replies = JSON.parse(jsonStr);
    } catch(e) {
      console.error("Failed to parse AI JSON replies", text);
      replies = ["Sounds good.", "Thanks!", "Will review."];
    }

    return NextResponse.json({ replies });
  } catch (error) {
    console.error("AI Reply error:", error);
    return NextResponse.json({ error: "Failed to generate replies" }, { status: 500 });
  }
}
