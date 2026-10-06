import { GoogleGenAI } from '@google/genai';

// @desc    Generate code suggestion or explanation via Gemini
// @route   POST /api/ai/suggest
// @access  Private
export const generateSuggestion = async (req, res) => {
  const { prompt, codeContext, language } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    return res.status(400).json({
      message: 'GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY in backend/.env to enable AI features.',
    });
  }

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ message: 'Prompt is required.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    if (!response || !response.text) {
      throw new Error('No response returned by AI model');
    }

    res.json({ suggestion: response.text });
  } catch (error) {
    console.error('AI Assistant Error:', error.message);
    res.status(500).json({
      message: error.message || 'Failed to generate AI suggestion.',
    });
  }
};
