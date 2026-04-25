import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function generateReviewResponse(businessName: string, reviewerName: string, rating: number, comment: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        You are a professional social media manager for a business named "${businessName}".
        A customer named "${reviewerName}" left a ${rating}-star review with the following comment:
        "${comment}"
        
        Generate a polite, professional, and personalized response to this review. 
        If the review is positive, thank them and invite them back.
        If the review is negative, apologize, show empathy, and offer to resolve the issue privately.
        Keep the response concise (max 3 sentences).
      `,
    });
    
    return response.text?.trim() || "Thank you for your feedback.";
  } catch (error) {
    console.error("Error generating review response:", error);
    return "Thank you for your feedback. We appreciate your input and will look into this further.";
  }
}
