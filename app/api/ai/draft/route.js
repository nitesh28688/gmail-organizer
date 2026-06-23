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

    let result;
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      result = await model.generateContent(prompt);
    } catch (fallbackError) {
      console.warn("Falling back to gemini-pro...", fallbackError.message);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      result = await model.generateContent(prompt);
    }
    const response = await result.response;
    const resultText = response.text();

    if (!resultText) throw new Error("No response from AI");

    return NextResponse.json({ result: resultText.trim() });
  } catch (error) {
    console.error("AI Draft Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
