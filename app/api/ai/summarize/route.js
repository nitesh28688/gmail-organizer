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
      return NextResponse.json({ summary: "AI Summarization requires a GEMINI_API_KEY in your environment variables. Please add one to try this feature!" });
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

    let bestModel = available.find(n => n === "gemini-1.5-flash") || 
                    available.find(n => n === "gemini-1.5-pro") || 
                    available.find(n => n.includes("flash")) || 
                    available.find(n => n.includes("pro")) || 
                    available[0];

    if (!bestModel) throw new Error(`No compatible models found. Available: ${available.join(", ")}`);

    const model = genAI.getGenerativeModel({ model: bestModel });
    const prompt = `Summarize the following email in 3 short, punchy bullet points. Focus only on the most critical information:\n\n${emailContent.substring(0, 5000)}`;
    const result = await model.generateContent(prompt);
    
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ summary: text });
  } catch (error) {
    console.error("AI Summarize error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate summary" }, { status: 500 });
  }
}
