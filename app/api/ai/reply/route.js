import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit } from "../../../../lib/rateLimit";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(session.user.id, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

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

    const apiKey = process.env.GEMINI_API_KEY;
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const modelsData = await modelsRes.json();
    
    if (!modelsData.models) {
      throw new Error(`Failed to fetch models: ${JSON.stringify(modelsData)}`);
    }

    const available = modelsData.models
      .filter(m => m.supportedGenerationMethods.includes("generateContent"))
      .map(m => m.name.replace('models/', ''));

    if (available.length === 0) throw new Error("No compatible models found for this API key.");

    // Order models by preference: flash -> pro -> others
    available.sort((a, b) => {
      if (a.includes("flash") && !b.includes("flash")) return -1;
      if (b.includes("flash") && !a.includes("flash")) return 1;
      if (a.includes("pro") && !b.includes("pro")) return -1;
      if (b.includes("pro") && !a.includes("pro")) return 1;
      return 0;
    });

    const prompt = `Generate 3 short, realistic, and distinct quick reply options for this email. Return ONLY a JSON array of 3 strings (e.g. ["Yes, sounds good.", "No, thanks.", "Let's discuss next week."]). Email content:\n\n${emailContent.substring(0, 3000)}`;
    
    let result;
    let lastError;

    for (const modelName of available) {
      if (modelName.includes("vision")) continue;
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        break; // Success!
      } catch (e) {
        console.warn(`Model ${modelName} failed:`, e.message);
        lastError = e;
      }
    }

    if (!result) throw lastError;
    
    const response = await result.response;
    const text = response.text().trim();
    
    let replies;
    try {
      replies = JSON.parse(text);
    } catch(e) {
      const match = text.match(/\[.*\]/s);
      if (match) replies = JSON.parse(match[0]);
      else replies = text.split('\n').filter(l => l.trim().length > 0).slice(0,3);
    }

    return NextResponse.json({ replies });
  } catch (error) {
    console.error("AI Reply error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate replies" }, { status: 500 });
  }
}
