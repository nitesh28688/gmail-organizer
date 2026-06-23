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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let prompt = "";
    if (command === "Formalize") prompt = `Rewrite the following text to be more formal and professional, suitable for a business email. Output ONLY the rewritten text, nothing else. Text:\n\n${text}`;
    else if (command === "Fix Spelling & Grammar") prompt = `Fix any spelling or grammar mistakes in the following text. Do not change the tone. Output ONLY the corrected text, nothing else. Text:\n\n${text}`;
    else if (command === "Make Professional") prompt = `Rewrite the following text to sound highly professional, polite, and polished. Output ONLY the rewritten text, nothing else. Text:\n\n${text}`;
    else if (command === "Make Concise") prompt = `Rewrite the following text to be more concise and to the point. Output ONLY the rewritten text, nothing else. Text:\n\n${text}`;
    else prompt = `Process this text according to the command: "${command}". Output ONLY the result. Text:\n\n${text}`;

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
