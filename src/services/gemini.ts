import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_PROMPT = `You are a world-class Google Business Profile (GBP) and local SEO expert at CORTX GBP. 
Your goal is to help businesses dominate their local market through intelligent automation and strategic insights.
Always maintain a professional, helpful, and data-driven tone.`;

export async function generateReviewResponse(businessName: string, reviewerName: string, rating: number, comment: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          text: `You are responding to a customer review for "${businessName}". 
          User Name: ${reviewerName}
          Rating: ${rating}/5 stars
          Review: "${comment}"
          
          Generate a polite, professional response. 
          If positive: Express genuine gratitude and mention looking forward to seeing them again.
          If negative: Apologize sincerely, show empathy, and invite them to reach out privately to resolve it.
          Keep it under 300 characters.`
        }
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });
    
    return response.text?.trim() || "Thank you for your feedback.";
  } catch (error) {
    console.error("Error generating review response:", error);
    return "Thank you for your feedback. We appreciate your input and will look into this further.";
  }
}

export async function generateMarketingStrategy(businessName: string, category: string, currentMetrics: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          text: `Generate a 3-point local marketing strategy for "${businessName}" in the "${category}" category.
          Context: ${currentMetrics}
          
          Provide actionable steps for:
          1. Improving Review Velocity
          2. Content/Post Recommendations
          3. Local keyword focus
          
          Keep it professional and concise.`
        }
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.8,
      },
    });
    
    return response.text?.trim() || "Unable to generate strategy at this time.";
  } catch (error) {
    console.error("Error generating strategy:", error);
    return "Stay focused on local SEO and consistent customer engagement.";
  }
}
