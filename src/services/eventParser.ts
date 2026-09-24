// src/services/eventParser.ts
import { generateAIResponse } from './aiService';

export interface ParsedEvent {
  title: string;
  category: 'Career' | 'Study' | 'Health' | 'Social' | 'Other';
  event_date: string; // Định dạng YYYY-MM-DD HH:mm
  summary: string;
  actions?: string[];
}

export const parseEventFromText = async (userInput: string): Promise<ParsedEvent> => {
  const now = new Date();
  const currentDateStr = now.toLocaleString('vi-VN', { 
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const prompt = `
Bạn là một trợ lý AI phân tích lịch trình chuyên nghiệp.
Mốc thời gian hiện tại: ${currentDateStr} (Định dạng ISO tham chiếu: ${now.toISOString()}).

Nhiệm vụ: Phân tích đoạn văn bản người dùng và trích xuất thông tin sự kiện.
Đoạn văn bản: "${userInput}"

Yêu cầu về thời gian (event_date):
- Tính toán chính xác ngày giờ dựa trên mốc thời gian hiện tại ở trên.
- Nếu người dùng nói "lúc 8 giờ sáng ngày 21 tháng 9", hãy chuyển chính xác thành dạng "YYYY-09-21 08:00".
- Định dạng bắt buộc: "YYYY-MM-DD HH:mm".

BẮT BUỘC trả về CHUỖI JSON DUY NHẤT (không kèm markdown codeblock, không kèm câu dẫn khác):
{
  "title": "Tên sự kiện vắn tắt",
  "category": "Career | Study | Health | Social | Other",
  "event_date": "YYYY-MM-DD HH:mm",
  "summary": "Tóm tắt ngắn gọn"
}
`;

  try {
    const rawResponse = await generateAIResponse(prompt);
    // Làm sạch chuỗi phản hồi phòng trường hợp AI thêm markdown ```json
    const cleanedJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData: ParsedEvent = JSON.parse(cleanedJson);
    return parsedData;
  } catch (error) {
    console.error("Lỗi parse JSON từ AI:", error);
    // Fallback nếu AI không trả về đúng JSON
    return {
      title: userInput,
      category: 'Other',
      event_date: '',
      summary: userInput
    };
  }
};