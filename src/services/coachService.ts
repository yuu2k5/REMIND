// src/services/coachService.ts
import { generateAIResponse } from './aiService';

export interface ActionItem {
  task_description: string;
  scheduled_time: string; // YYYY-MM-DD HH:mm
}

export interface PlanResult {
  identified_mistakes: string[];
  action_items: ActionItem[];
}

// 1. AI đặt câu hỏi chẩn đoán dựa trên sự kiện sắp tới
export const generateReflectionQuestion = async (eventTitle: string, category: string): Promise<string> => {
  const prompt = `
Bạn là một AI Coach chuyên nghiệp. Người dùng chuẩn bị tham gia sự kiện: "${eventTitle}" (Thể loại: ${category}).
Hãy đặt 1 câu hỏi ngắn gọn, thân thiện (dưới 25 từ) để hỏi người dùng về trải nghiệm hoặc lỗi sai họ từng gặp phải trong các sự kiện tương tự trước đây.
`;
  return await generateAIResponse(prompt);
};

// 2. AI phân tích trải nghiệm cũ và tạo Action Plan chi tiết
export const generateActionPlan = async (
  eventTitle: string,
  eventDate: string,
  pastExperience: string
): Promise<PlanResult> => {
  const now = new Date();
  const currentDateTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const prompt = `
BẠN LÀ PHÂN TÍCH VIÊN HỆ THỐNG AI COACH.
LƯU Ý QUAN TRỌNG VỀ THỜI GIAN:
- Hôm nay LÀ NGÀY THỰC TẾ: ${currentDateTimeStr}
- Mọi mốc thời gian (scheduled_time) bạn tạo ra cho các action_items BẮT BUỘC PHẢI DIỄN RA TRONG TƯƠNG LAI VÀ TRƯỚC KHI THỜI GIAN SỰ KIỆN XẢY RA, tính từ mốc ${currentDateTimeStr} trở đi.
- KHÔNG ĐƯỢC LẤY CÁC NGÀY TRONG QUÁ KHỨ (như tháng 8 hay các tháng trước).
- Định dạng trả về bắt buộc: YYYY-MM-DD HH:mm

Sự kiện sắp tới: "${eventTitle}" diễn ra vào ngày: ${eventDate}.
Trải nghiệm/lỗi sai trong quá khứ của người dùng: "${pastExperience}".

Nhiệm vụ:
1. Phân tích các lỗi sai/điểm yếu chính từ chia sẻ của người dùng.
2. Đưa ra 3-4 hành động cụ thể, thiết thực để khắc phục lỗi sai đó và chuẩn bị tốt nhất cho sự kiện sắp tới.
3. Mỗi hành động phải có thời gian thực hiện hợp lý (xảy ra TRƯỚC ngày diễn ra sự kiện).

BẮT BUỘC trả về chuỗi JSON DUY NHẤT (không kèm markdown, không kèm lời dẫn):
{
  "identified_mistakes": ["Lỗi sai 1", "Lỗi sai 2"],
  "action_items": [
    {
      "task_description": "Mô tả hành động 1",
      "scheduled_time": "YYYY-MM-DD 09:00"
    }
  ]
}
`;

  const rawResponse = await generateAIResponse(prompt);

  try {
    const cleanedJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedJson) as PlanResult;
  } catch (error) {
    console.error("Lỗi parse Action Plan:", rawResponse);
    throw new Error("AI không thể khởi tạo Action Plan. Vui lòng thử lại.");
  }
};