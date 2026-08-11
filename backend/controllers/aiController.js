import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client.
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// @desc    Generate code suggestion or explanation via Gemini
// @route   POST /api/ai/suggest
// @access  Private
export const generateSuggestion = async (req, res) => {
  const { prompt, codeContext, language } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ message: 'GEMINI_API_KEY is not configured on the server.' });
  }

  if (!prompt) {
    return res.status(400).json({ message: 'Prompt is required.' });
  }

  try {
    const systemInstruction = `You are an expert AI Code Assistant integrated into a collaborative IDE. 
Your job is to analyze, refactor, or explain the provided code based on the user's prompt. 
Provide concise, helpful answers. Format your code snippets in markdown.`;

    let fullPrompt = prompt;
    if (codeContext) {
      fullPrompt = `Language: ${language || 'unknown'}
---
Active File Code Context:
\`\`\`${language || ''}
${codeContext}
\`\`\`
---
User Query:
${prompt}`;
    }

    const response = await ai?.models?.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
            systemInstruction,
            temperature: 0.2, // Low temperature for more deterministic/coding answers
        }
    });

    if (!response) {
      throw new Error('AI client not initialized');
    }

    res.json({ suggestion: response.text });
  } catch (error) {
    console.error("AI Assistant Error:", error);
    res.status(500).json({ message: 'Failed to generate AI suggestion.' });
  }
};
