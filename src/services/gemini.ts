import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY) || '' });

const SYSTEM_PROMPT = `You are a world-class Google Business Profile (GBP) and local SEO expert at CORTX GBP. 
Your goal is to help businesses dominate their local market through intelligent automation and strategic insights.
Always maintain a professional, helpful, and data-driven tone.`;

export async function generateReviewResponse(businessName: string, reviewerName: string, rating: number, comment: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
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

export async function generateMarketingStrategy(profile: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          text: `Generate a comprehensive local marketing strategy for the following Google Business Profile:
          Name: ${profile.name}
          Category: ${profile.category}
          Description: ${profile.description}
          Address: ${profile.address}
          
          Provide 5 actionable strategy points focusing on:
          1. Local ranking improvements
          2. Content frequency and topics
          3. Review generation tactics
          4. Photo/Video opportunities
          5. Competitor differentiation
          
          Format the output as a clear list of strategy items.`
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

export async function generatePostContent(profile: any, topic: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          text: `Create a professional Google Business Profile post for "${profile.name}".
          Category: ${profile.category}
          Topic: ${topic}
          
          The post should:
          - Be engaging and conversion-oriented
          - Include a clear call-to-action
          - Use relevant emojis
          - Be optimized for local search
          - Be between 150-300 characters
          
          Output only the post content.`
        }
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });
    
    return response.text?.trim() || "Exciting things are happening at our business! Visit us to learn more.";
  } catch (error) {
    console.error("Error generating post content:", error);
    return "Visit us today to see what's new!";
  }
}

export async function generateQA(profile: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          text: `Generate 3 frequently asked questions and answers for "${profile.name}" (${profile.category}).
          
          Focus on common customer concerns like:
          - Services/Products offered
          - Operational details
          - Special features or why choose them
          
          Format as JSON: [{"question": "...", "answer": "..."}]`
        }
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });
    
    return response.text?.trim() || "[]";
  } catch (error) {
    console.error("Error generating Q&A:", error);
    return "[]";
  }
}

export async function analyzeBusinessProfile(profile: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          text: `Perform a detailed SEO audit for this Google Business Profile:
          Name: ${profile.name}
          Category: ${profile.category}
          Address: ${profile.address}
          Website: ${profile.website}
          Description: ${profile.description}
          
          Return a JSON object with:
          - score (0-100)
          - sections: array of {name, score, status, findings}
          - recommendation: single most impactful next step
          
          Sections to evaluate: Profile Completeness, Visibility, Content Quality, Reputation.
          Output ONLY the JSON.`
        }
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.5,
      },
    });
    
    const text = response.text?.trim() || "";
    // Clean up JSON if necessary (sometimes AI returns markdown)
    const jsonStr = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error analyzing profile:", error);
    return {
      score: 50,
      sections: [],
      recommendation: "Ensure all business information is complete and accurate."
    };
  }
}
