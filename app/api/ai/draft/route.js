import { getServerSession } from "next-auth";
import { authOptions } from "../../../api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { text, command } = await request.json();
    if (!text || !command) return NextResponse.json({ error: "Missing text or command" }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set in .env" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    let prompt = "";
    if (command === "Formalize") prompt = `Rewrite the following text to be more formal and professional, suitable for a business email. Output ONLY the rewritten text, nothing else. Text:\n\n${text}`;
    else if (command === "Fix Spelling & Grammar") prompt = `Fix all spelling and grammar mistakes in the following text. Do not change the meaning. Output ONLY the corrected text, nothing else. Text:\n\n${text}`;
    else if (command === "Make Professional") prompt = `Rewrite the following text to sound extremely professional and polite. Output ONLY the rewritten text. Text:\n\n${text}`;
    else if (command === "Make Concise") prompt = `Rewrite the following text to be as concise and brief as possible without losing the core meaning. Output ONLY the rewritten text. Text:\n\n${text}`;
    else prompt = `Rewrite the following text based on this instruction: ${command}. Output ONLY the rewritten text. Text:\n\n${text}`;

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
    const result = await model.generateContent(prompt);
    
    const response = await result.response;
    const resultText = response.text();

    if (!resultText) throw new Error("No response from AI");

    return NextResponse.json({ result: resultText.trim() });
  } catch (error) {
    console.error("AI Draft Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
