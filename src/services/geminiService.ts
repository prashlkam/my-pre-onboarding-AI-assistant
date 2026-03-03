/// <reference types="vite/client" />
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });

export async function extractIdentity(message: string): Promise<{ name: string; role: string } | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract the full name and the job role from the following message. If either is missing, return null for that field.\n\nMessage: "${message}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "The full name of the candidate.",
            },
            role: {
              type: Type.STRING,
              description: "The job role or position they are shortlisted for.",
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Error extracting identity:", error);
    return null;
  }
}

export async function evaluateInstructionResponse(message: string): Promise<{ status: 'ACCEPT' | 'OBJECTION'; reason?: string }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an onboarding assistant. The user just replied: "${message}". Does this mean they accept the instruction, or do they have an objection/question?`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: {
              type: Type.STRING,
              description: "Must be exactly 'ACCEPT' or 'OBJECTION'.",
            },
            reason: {
              type: Type.STRING,
              description: "If 'OBJECTION', provide the reason or the question they asked. Otherwise leave empty.",
            },
          },
          required: ["status"],
        },
      },
    });

    const text = response.text;
    if (!text) return { status: 'ACCEPT' };
    const result = JSON.parse(text);
    return {
      status: result.status === 'OBJECTION' ? 'OBJECTION' : 'ACCEPT',
      reason: result.reason,
    };
  } catch (error) {
    console.error("Error evaluating instruction response:", error);
    return { status: 'ACCEPT' };
  }
}

export async function evaluateChecklistResponse(message: string): Promise<'COMPLETED' | 'PENDING'> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an onboarding assistant. The user just replied: "${message}" to a question about whether they have completed a checklist item. Have they completed it?`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: {
              type: Type.STRING,
              description: "Must be exactly 'COMPLETED' or 'PENDING'.",
            },
          },
          required: ["status"],
        },
      },
    });

    const text = response.text;
    if (!text) return 'PENDING';
    const result = JSON.parse(text);
    return result.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING';
  } catch (error) {
    console.error("Error evaluating checklist response:", error);
    return 'PENDING';
  }
}
