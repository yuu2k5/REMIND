// src/services/ollamaService.ts
import { getUserSettings } from '../database/coachDatabase';
const OLLAMA_CHAT_URL = 'http://10.0.2.2:11434/api/chat'; // Đổi IP nếu dùng thiết bị thật

export type ChatState =
  | 'STEP_1_EVENT_RECEIVED'
  | 'STEP_2_ANALYZE_CONCERN'
  | 'STEP_3_ASK_CONFIRMATION'
  | 'STEP_4_CREATE_ACTION_PLAN';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaContext {
  currentState: ChatState;
  eventTitle?: string;
  pastLessons?: string[];
  language?: 'vi' | 'en'; // Sẵn sàng cho việc mở rộng chọn ngôn ngữ sau này
}

export const queryOllamaCoach = async (
  chatHistory: { sender: 'user' | 'ai'; text: string }[],
  context: OllamaContext
): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  // Lấy dữ liệu cá nhân hóa người dùng từ SQLite
  const userProfile = await getUserSettings();
  const userInfoPrompt = userProfile ? `
[THÔNG TIN NGƯỜI DÙNG]
- Tên: ${userProfile.full_name || 'Bạn'}
- Độ tuổi: ${userProfile.age_group || 'Chưa rõ'}
- Nghề nghiệp: ${userProfile.occupation || 'Chưa rõ'}
*Hãy cá nhân hóa lời khuyên, xưng xưng xưng hô và văn phong sao cho đồng cảm, sát với ngành nghề và độ tuổi của họ.*
` : '';

  const currentLang = context.language || 'vi';
  const langInstruction = currentLang === 'vi' 
    ? 'BẮT BUỘC TRẢ LỜI 100% BẰNG TIẾNG VIỆT. TUYỆT ĐỐI KHÔNG DÙNG TIẾNG TRUNG HOẶC BẤT KỲ NGÔN NGỮ NÀO KHÁC.'
    : 'ALWAYS RESPOND IN ENGLISH.';

  try {
    const lessonsText =
      context.pastLessons && context.pastLessons.length > 0
        ? context.pastLessons.map((l) => `- ${l}`).join('\n')
        : 'Chưa có bài học cũ nào liên quan.';

    let stateInstruction = '';

    switch (context.currentState) {
      case 'STEP_1_EVENT_RECEIVED':
        stateInstruction = `
Nhiệm vụ lượt này:
1. Nhắc lại các bài học/lỗi sai cũ trong quá khứ (nếu có): 
${lessonsText}
2. Đồng cảm và hỏi người dùng xem lần này họ có lo lắng hay muốn tập trung chuẩn bị kỹ cho phần nào không.
3. KHÔNG hỏi ngày giờ ở lượt này.
`;
        break;

      case 'STEP_2_ANALYZE_CONCERN':
        stateInstruction = `
Nhiệm vụ lượt này:
1. Thấu hiểu và lắng nghe mối lo lắng người dùng vừa chia sẻ.
2. Đưa ra 1-2 lời khuyên phân tích/trấn an ngắn gọn.
3. Hỏi người dùng ngày và giờ cụ thể sự kiện "${context.eventTitle || 'này'}" sẽ diễn ra để bạn giúp lên lịch.
`;
        break;

      case 'STEP_3_ASK_CONFIRMATION':
        stateInstruction = `
Nhiệm vụ lượt này:
1. Ghi nhận mốc thời gian người dùng vừa cung cấp.
2. Hỏi trực tiếp xem người dùng có muốn bạn tự động tạo sự kiện vào lịch kèm các bước Action Plan chuẩn bị hay không.
`;
        break;

      case 'STEP_4_CREATE_ACTION_PLAN':
        stateInstruction = `
Nhiệm vụ lượt này:
1. Báo cho người dùng biết sự kiện đã được lưu thành công vào lịch.
2. Đưa ra 2-3 bước Action Plan chuẩn bị ngắn gọn dựa trên mối lo lắng đã trao đổi.
`;
        break;
    }

    const systemPrompt = `
[QUY TẮC NGÔN NGỮ HÀNG ĐẦU]
${langInstruction}

[THÔNG TIN NGƯỜI DÙNG CẦN TƯ VẤN]
${userInfoPrompt}

[VAI TRÒ & GIỌNG VĂN]
Bạn là AI Coach đồng hành hỗ trợ quản lý thời gian và học tập cho người Việt.
Xưng hô: "mình" và "${userProfile?.full_name || 'bạn'}". Giọng văn ấm áp, ngắn gọn (tối đa 3-4 câu), tự nhiên như một người bạn.

Sự kiện đang thảo luận: "${context.eventTitle || 'Chưa xác định'}"

${stateInstruction}

[LƯU Ý QUAN TRỌNG]
1. NGUYÊN TẮC CỐT LÕI: Phải viết toàn bộ câu trả lời bằng TIẾNG VIỆT CHUẨN. Không chèn từ tiếng Trung hay ký tự Trung Quốc.
2. Phản hồi tiếp nối tự nhiên dựa vào Lịch sử trò chuyện bên dưới. Không nhắc lại những câu hỏi mà người dùng đã trả lời.
`;

    const formattedMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-6).map((msg) => ({
        role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.text,
      })),
    ];

    const response = await fetch(OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        messages: formattedMessages,
        stream: false,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama Chat API lỗi HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content ? data.message.content.trim() : 'Mình đã ghi nhận! Bạn có thể nói rõ hơn được không?';
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('❌ Lỗi kết nối Ollama Chat:', error);

    if (context.currentState === 'STEP_1_EVENT_RECEIVED') {
      return `Mình đã ghi nhận sự kiện "${context.eventTitle}"! Lần này bạn có lo lắng hay cần chuẩn bị kỹ cho phần nào không?`;
    }
    if (context.currentState === 'STEP_2_ANALYZE_CONCERN') {
      return `Hiểu rồi, lo lắng của bạn rất hợp lý. Bạn có thể cho mình xin ngày giờ cụ thể diễn ra sự kiện để mình lên lịch giúp bạn không?`;
    }
    return `Mình đã ghi nhận thông tin! Bạn có muốn mình tạo lịch và bổ sung Action Plan không?`;
  }
};