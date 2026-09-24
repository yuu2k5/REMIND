// src/services/aiService.ts
import axios from 'axios';
import { CONFIG } from '../config';

export const generateAIResponse = async (prompt: string): Promise<string> => {
  if (CONFIG.USE_LOCAL_AI) {
    // ----------------------------------------------------
    // LUỒNG 1: Gọi Local AI (Ollama)
    // ----------------------------------------------------
    try {
      console.log('🤖 Sending request to Local Ollama...');
      const response = await axios.post(CONFIG.OLLAMA_BASE_URL, {
        model: CONFIG.OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
      });
      return response.data.response;
    } catch (error) {
      console.error('❌ Error calling Local Ollama:', error);
      throw new Error('Không thể kết nối tới Ollama Local API.');
    }
  } else {
    // ----------------------------------------------------
    // LUỒNG 2: Gọi Google Gemini API
    // ----------------------------------------------------
    try {
      console.log('☁️ Sending request to Google Gemini API...');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
      
      const response = await axios.post(url, {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      });

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('❌ Error calling Gemini API:', error);
      throw new Error('Không thể kết nối tới Google Gemini API.');
    }
  }
};