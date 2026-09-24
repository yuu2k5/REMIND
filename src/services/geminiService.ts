// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lấy API Key từ file .env hoặc cấu hình ứng dụng
const API_KEY = 'YOUR_GEMINI_API_KEY'; 
const genAI = new GoogleGenerativeAI(API_KEY);

export const queryGeminiCoach = async (
  userMessage: string,
  pastLessons: string[]
): Promise<string> => {
  try {
    // Dùng model gemini-1.5-flash để cho tốc độ xử lý nhanh nhất
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const lessonsText = pastLessons.length > 0
      ? `Các bài học/lỗi sai trong quá khứ của người dùng:\n- ${pastLessons.join('\n- ')}`
      : 'Chưa có bài học cũ.';

    const prompt = `
Bạn là AI Coach trợ lý quản lý thời gian thân thiện, xưng "mình" và gọi "bạn".

Bối cảnh quá khứ:
${lessonsText}

Nhiệm vụ:
1. Nhắc lại nhẹ nhàng bài học quá khứ nếu có.
2. Hỏi về điều người dùng lo lắng và ngày giờ cụ thể của sự kiện.
3. Giữ câu trả lời ngắn gọn, tự nhiên.

Tin nhắn của người dùng: "${userMessage}"
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('❌ Lỗi Gemini API:', error);
    throw error;
  }
};