// src/database/coachDatabase.ts
import * as SQLite from 'expo-sqlite';
import { PlanResult } from '../services/coachService';
import { getDBConnection } from './schema';

const DB_NAME = 'ai_coach.db';

export const saveReflectionAndActionPlan = async (
  eventId: string,
  pastExperience: string,
  planResult: PlanResult
) => {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const reflectionId = Date.now().toString();

    // 1. Ép kiểu tuyệt đối chống null/undefined
    const safeEventId = String(eventId || '');
    const safePastExperience = String(pastExperience || '').trim();
    
    // Đảm bảo identified_mistakes luôn là chuỗi JSON Valid
    const mistakesArray = Array.isArray(planResult?.identified_mistakes) 
      ? planResult.identified_mistakes 
      : [];
    const safeIdentifiedMistakes = JSON.stringify(mistakesArray);

    // Lưu Reflection
    await db.runAsync(
      `INSERT INTO reflections (id, event_id, past_experience, identified_mistakes) VALUES (?, ?, ?, ?);`,
      [reflectionId, safeEventId, safePastExperience, safeIdentifiedMistakes]
    );

    // 2. Lưu từng Action Item với Validation chặt chẽ
    const actionItems = Array.isArray(planResult?.action_items) ? planResult.action_items : [];

    for (const item of actionItems) {
      const actionId = Math.random().toString(36).substring(2, 9);
      
      // Ép kiểu String cho mọi tham số truyền vào bindParams
      const safeTaskDescription = String(item?.task_description || 'Nhiệm vụ không có mô tả').trim();
      const safeScheduledTime = String(item?.scheduled_time || new Date().toISOString()).trim();

      await db.runAsync(
        `INSERT INTO action_items (id, event_id, task_description, scheduled_time, is_completed) VALUES (?, ?, ?, ?, ?);`,
        [actionId, safeEventId, safeTaskDescription, safeScheduledTime, 0] // 0 đại diện cho false
      );
    }

    console.log('✅ Đã lưu Reflection & Action Plan thành công!');
  } catch (error) {
    console.error('❌ Lỗi khi lưu Reflection & Action Plan vào SQLite:', error);
    throw error;
  }
};

// Lấy danh sách Action Items theo Event ID
export const getActionItemsByEvent = async (eventId: string) => {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const safeEventId = String(eventId || '');
    return await db.getAllAsync(
      'SELECT * FROM action_items WHERE event_id = ? ORDER BY scheduled_time ASC;', 
      [safeEventId]
    );
  } catch (error) {
    console.error('❌ Lỗi khi lấy Action Items:', error);
    return [];
  }
};

// Đánh dấu hoàn thành 1 Action Item
export const toggleActionItemComplete = async (actionId: string, currentStatus: number) => {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const safeActionId = String(actionId || '');
    const newStatus = currentStatus === 1 ? 0 : 1;
    await db.runAsync(
      'UPDATE action_items SET is_completed = ? WHERE id = ?;', 
      [newStatus, safeActionId]
    );
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật trạng thái Action Item:', error);
  }
};

// Xóa một sự kiện và dữ liệu liên quan
export const deleteEvent = async (eventId: any) => {
  try {
    // 1. Kiểm tra an toàn: Nếu eventId không hợp lệ thì dừng ngay, tránh gọi SQLite
    if (!eventId || eventId === 'undefined' || eventId === 'null') {
      console.warn('⚠️ eventId không hợp lệ, bỏ qua thao tác xóa:', eventId);
      return;
    }

    const safeEventId = String(eventId).trim();
    const db = await SQLite.openDatabaseAsync(DB_NAME);

    // 2. Thực thi xóa an toàn
    await db.runAsync('DELETE FROM action_items WHERE event_id = ?;', [safeEventId]);
    await db.runAsync('DELETE FROM reflections WHERE event_id = ?;', [safeEventId]);
    await db.runAsync('DELETE FROM events WHERE id = ?;', [safeEventId]);

    console.log(`✅ Đã xóa event [${safeEventId}] thành công`);
  } catch (error) {
    console.error('❌ Lỗi khi xóa sự kiện:', error);
    throw error;
  }
};

// Lưu đánh giá sau khi sự kiện kết thúc
export const saveEvaluation = async (
  eventId: string,
  score: number,
  feedback: string,
  takeaways: string
) => {
  try {
    const db = await SQLite.openDatabaseAsync('ai_coach.db');
    const evalId = Date.now().toString();
    const safeEventId = String(eventId || '');

    // 1. Lưu vào bảng evaluations
    await db.runAsync(
      `INSERT INTO evaluations (id, event_id, helpfulness_score, user_feedback, key_takeaways) 
       VALUES (?, ?, ?, ?, ?);`,
      [evalId, safeEventId, score, String(feedback || ''), String(takeaways || '')]
    );

    // 2. Cập nhật trạng thái event thành COMPLETED
    await db.runAsync(
      `UPDATE events SET status = 'COMPLETED' WHERE id = ?;`,
      [safeEventId]
    );

    console.log(`✅ Đã lưu Evaluation và cập nhật COMPLETED cho event [${safeEventId}]`);
  } catch (error) {
    console.error('❌ Lỗi khi lưu Evaluation:', error);
    throw error;
  }
};

// Lấy thông tin đánh giá cũ của sự kiện (nếu có)
export const getEvaluationByEvent = async (eventId: string) => {
  try {
    const db = await SQLite.openDatabaseAsync('ai_coach.db');
    const safeEventId = String(eventId || '');
    const result: any[] = await db.getAllAsync(
      'SELECT * FROM evaluations WHERE event_id = ?;',
      [safeEventId]
    );
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('❌ Lỗi khi lấy thông tin Evaluation:', error);
    return null;
  }
};

// 1. Lấy danh sách sự kiện Màn hình chính (UPCOMING & NEED_REVIEW)
export const getActiveEventsFromDB = async () => {
  try {
    const db = await SQLite.openDatabaseAsync('ai_coach.db');
    const events: any[] = await db.getAllAsync(
      `SELECT * FROM events WHERE status != 'COMPLETED' ORDER BY event_date ASC;`
    );
    return events;
  } catch (error) {
    console.error('❌ Lỗi lấy active events:', error);
    return [];
  }
};

// 2. Lấy danh sách sự kiện Đã hoàn thành (COMPLETED Dashboard) kèm thông tin Review & Task
export const getCompletedEventsHistory = async () => {
  try {
    const db = await SQLite.openDatabaseAsync('ai_coach.db');
    // Join bảng events, evaluations và đếm số task đã hoàn thành
    const result: any[] = await db.getAllAsync(`
      SELECT 
        e.id, 
        e.title, 
        e.category, 
        e.event_date,
        ev.helpfulness_score,
        ev.user_feedback,
        ev.key_takeaways,
        (SELECT COUNT(*) FROM action_items ai WHERE ai.event_id = e.id AND ai.is_completed = 1) as completed_tasks_count
      FROM events e
      LEFT JOIN evaluations ev ON e.id = ev.event_id
      WHERE e.status = 'COMPLETED'
      ORDER BY e.event_date DESC;
    `);
    return result;
  } catch (error) {
    console.error('❌ Lỗi lấy completed events history:', error);
    return [];
  }
};

export async function getReflectionByEvent(eventId: number | string) {
  const db = await getDBConnection();
  // BẮT BUỘC phải lọc đúng theo event_id
  const result = await db.getAllAsync<any>(
    `SELECT * FROM event_reflections WHERE event_id = ? ORDER BY id DESC LIMIT 1;`,
    [eventId]
  );
  return result.length > 0 ? result[0] : null;
}

export interface UserSettings {
  id?: string;
  full_name: string;
  age_group: string;
  occupation: string;
  notifications_enabled: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  is_premium: number;
  is_onboarded: number;
}

// 1. Lấy cấu hình user
export const getUserSettings = async (): Promise<UserSettings | null> => {
  try {
    const db = await getDBConnection();
    const rows: UserSettings[] = await db.getAllAsync(
      'SELECT * FROM user_settings WHERE id = "default_user" LIMIT 1;'
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('❌ Lỗi lấy user_settings:', error);
    return null;
  }
};

// 2. Lưu Onboarding ban đầu
export const saveOnboardingProfile = async (
  fullName: string, 
  ageGroup: string, 
  occupation: string
) => {
  try {
    const db = await getDBConnection();
    await db.runAsync(`
      INSERT INTO user_settings (id, full_name, age_group, occupation, is_onboarded) 
      VALUES ('default_user', ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        full_name = excluded.full_name,
        age_group = excluded.age_group,
        occupation = excluded.occupation,
        is_onboarded = 1;
    `, [fullName, ageGroup, occupation]);
    console.log('✅ Đã lưu thông tin Onboarding!');
  } catch (error) {
    console.error('❌ Lỗi lưu Onboarding Profile:', error);
    throw error;
  }
};

// 3. Cập nhật Settings từ Màn hình Dashboard
export const updateUserSettings = async (settings: Partial<UserSettings>) => {
  try {
    const db = await getDBConnection();
    const current = await getUserSettings();

    const fullName = settings.full_name ?? current?.full_name ?? '';
    const ageGroup = settings.age_group ?? current?.age_group ?? '';
    const occupation = settings.occupation ?? current?.occupation ?? '';
    const notiEnabled = settings.notifications_enabled ?? current?.notifications_enabled ?? 1;
    const quietStart = settings.quiet_hours_start ?? current?.quiet_hours_start ?? '22:00';
    const quietEnd = settings.quiet_hours_end ?? current?.quiet_hours_end ?? '07:00';
    const isPremium = settings.is_premium ?? current?.is_premium ?? 0;

    await db.runAsync(`
      INSERT INTO user_settings (id, full_name, age_group, occupation, notifications_enabled, quiet_hours_start, quiet_hours_end, is_premium, is_onboarded) 
      VALUES ('default_user', ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        full_name = excluded.full_name,
        age_group = excluded.age_group,
        occupation = excluded.occupation,
        notifications_enabled = excluded.notifications_enabled,
        quiet_hours_start = excluded.quiet_hours_start,
        quiet_hours_end = excluded.quiet_hours_end,
        is_premium = excluded.is_premium;
    `, [fullName, ageGroup, occupation, notiEnabled, quietStart, quietEnd, isPremium]);

    console.log('✅ Cập nhật User Settings thành công!');
  } catch (error) {
    console.error('❌ Lỗi cập nhật User Settings:', error);
    throw error;
  }
};

export interface ChatMessage {
  id: string;
  session_id: string;
  sender: 'user' | 'ai';
  text: string;
  created_at?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------
// 1. TÍNH NĂNG XÓA TÀI KHOẢN & RESET DỮ LIỆU
// ----------------------------------------------------
export const deleteAccountAndResetData = async () => {
  try {
    const db = await getDBConnection();
    await db.execAsync('DELETE FROM chat_messages;');
    await db.execAsync('DELETE FROM chat_sessions;');
    await db.execAsync('DELETE FROM evaluations;');
    await db.execAsync('DELETE FROM preparation_tasks;');
    await db.execAsync('DELETE FROM reflections;');
    await db.execAsync('DELETE FROM events;');
    await db.execAsync('DELETE FROM user_settings;');
    console.log('💥 Đã xoá toàn bộ dữ liệu tài khoản thành công!');
  } catch (error) {
    console.error('❌ Lỗi khi xoá dữ liệu tài khoản:', error);
    throw error;
  }
};

// ----------------------------------------------------
// 2. QUẢN LÝ CHAT SESSIONS & MESSAGES (GEMINI STYLE)
// ----------------------------------------------------

// Tạo phiên Chat mới
export const createChatSession = async (title: string = 'Cuộc trò chuyện mới'): Promise<string> => {
  const db = await getDBConnection();
  const sessionId = 'session_' + Date.now();
  await db.runAsync(
    'INSERT INTO chat_sessions (id, title) VALUES (?, ?);',
    [sessionId, title]
  );
  return sessionId;
};

// Lấy danh sách các cuộc trò chuyện (xếp mới nhất lên đầu)
export const getChatSessions = async (): Promise<ChatSession[]> => {
  try {
    const db = await getDBConnection();
    return await db.getAllAsync<ChatSession>(
      'SELECT * FROM chat_sessions ORDER BY updated_at DESC;'
    );
  } catch (error) {
    console.error('❌ Lỗi lấy chat sessions:', error);
    return [];
  }
};

// Lưu tin nhắn mới vào phiên Chat
export const saveChatMessage = async (sessionId: string, sender: 'user' | 'ai', text: string) => {
  try {
    const db = await getDBConnection();
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    
    await db.runAsync(
      'INSERT INTO chat_messages (id, session_id, sender, text) VALUES (?, ?, ?, ?);',
      [messageId, sessionId, sender, text]
    );

    // Cập nhật lại thời gian updated_at của session
    await db.runAsync(
      'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;',
      [sessionId]
    );
  } catch (error) {
    console.error('❌ Lỗi lưu tin nhắn:', error);
  }
};

// Lấy toàn bộ tin nhắn thuộc một Session
export const getMessagesBySessionId = async (sessionId: string): Promise<ChatMessage[]> => {
  try {
    const db = await getDBConnection();
    return await db.getAllAsync<ChatMessage>(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC;',
      [sessionId]
    );
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách tin nhắn:', error);
    return [];
  }
};

// Cập nhật tiêu đề cuộc trò chuyện
export const updateChatSessionTitle = async (sessionId: string, newTitle: string) => {
  try {
    const db = await getDBConnection();
    await db.runAsync(
      'UPDATE chat_sessions SET title = ? WHERE id = ?;',
      [newTitle, sessionId]
    );
  } catch (error) {
    console.error('❌ Lỗi đổi tên session:', error);
  }
};

// Xóa 1 cuộc trò chuyện
export const deleteChatSession = async (sessionId: string) => {
  try {
    const db = await getDBConnection();
    await db.runAsync('DELETE FROM chat_sessions WHERE id = ?;', [sessionId]);
  } catch (error) {
    console.error('❌ Lỗi xóa chat session:', error);
  }
};

export async function updateActionItemScheduledTime(itemId: string | number, scheduledTime: string) {
  const db = await getDBConnection();
  await db.runAsync(
    `UPDATE action_items SET scheduled_time = ? WHERE id = ?;`,
    [scheduledTime, itemId]
  );
}