// src/database/eventService.ts
import { getDBConnection } from './schema';
import { ParsedEvent } from '../services/eventParser';

/**
 * Helper: Chuyển đổi mọi định dạng ngày (bao gồm tiếng Việt) sang dạng chuẩn YYYY-MM-DD HH:mm
 */
export const formatToStandardDateTime = (rawDateStr: string): string => {
  if (!rawDateStr) return '';

  let dateObj: Date | null = null;

  // 1. Nếu chuỗi dạng tiếng Việt tự nhiên (VD: "9 giờ 20 phút tối thứ 5 ngày 3 tháng 9")
  if (rawDateStr.includes('ngày') || rawDateStr.includes('giờ')) {
    const hourMatch = rawDateStr.match(/(\d{1,2})\s*giờ/i);
    const minuteMatch = rawDateStr.match(/(\d{1,2})\s*phút/i);
    const dayMatch = rawDateStr.match(/ngày\s*(\d{1,2})/i);
    const monthMatch = rawDateStr.match(/tháng\s*(\d{1,2})/i);
    const yearMatch = rawDateStr.match(/năm\s*(\d{4})/i);

    const isPM = /tối|chiều|đêm/i.test(rawDateStr);

    if (hourMatch && dayMatch && monthMatch) {
      let hours = parseInt(hourMatch[1], 10);
      const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
      const day = parseInt(dayMatch[1], 10);
      const month = parseInt(monthMatch[1], 10) - 1;
      const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

      if (isPM && hours < 12) {
        hours += 12;
      }

      dateObj = new Date(year, month, day, hours, minutes);
    }
  }

  // 2. Nếu là chuỗi ISO hoặc định dạng chuẩn khác
  if (!dateObj || isNaN(dateObj.getTime())) {
    const parsed = Date.parse(rawDateStr.replace(' ', 'T'));
    if (!isNaN(parsed)) {
      dateObj = new Date(parsed);
    }
  }

  // Nếu không parse được thì giữ nguyên bản
  if (!dateObj || isNaN(dateObj.getTime())) {
    return rawDateStr;
  }

  // Trả về chuỗi YYYY-MM-DD HH:mm
  const YYYY = dateObj.getFullYear();
  const MM = String(dateObj.getMonth() + 1).padStart(2, '0');
  const DD = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');

  return `${YYYY}-${MM}-${DD} ${hh}:${mm}`;
};

// 1. Lưu sự kiện từ Màn hình tạo lịch thông thường
export const saveEventToDB = async (event: ParsedEvent): Promise<string> => {
  try {
    const db = await getDBConnection();
    const newId = Date.now().toString();
    // Chuyển sang định dạng YYYY-MM-DD HH:mm trước khi lưu
    const formattedDate = formatToStandardDateTime(event.event_date);

    await db.runAsync(
      `INSERT INTO events (id, title, category, event_date, status) VALUES (?, ?, ?, ?, 'ACTIVE');`,
      [newId, event.title, event.category || 'Other', formattedDate]
    );

    if (event.actions && event.actions.length > 0) {
      let counter = 0;
      for (const actionTitle of event.actions) {
        counter++;
        const taskId = `${newId}_task_${counter}_${Math.random().toString(36).substr(2, 4)}`;
        await db.runAsync(
          'INSERT INTO preparation_tasks (id, event_id, title, is_completed) VALUES (?, ?, ?, 0);',
          [taskId, newId, actionTitle]
        );
      }
    }

    console.log('✅ Đã lưu sự kiện thành công từ App với ID:', newId);
    return newId;
  } catch (error) {
    console.error('❌ Lỗi khi saveEventToDB:', error);
    throw error;
  }
};



// 3. Lấy thông tin sự kiện kèm kiểm tra xem đã có Reflection/Action Plan chưa
export const getEventDetailWithReflection = async (eventId: string) => {
  try {
    const db = await getDBConnection();
    
    const events: any[] = await db.getAllAsync('SELECT * FROM events WHERE id = ?;', [eventId]);
    if (events.length === 0) return null;

    const reflections: any[] = await db.getAllAsync('SELECT * FROM reflections WHERE event_id = ?;', [eventId]);
    const tasks: any[] = await db.getAllAsync('SELECT * FROM preparation_tasks WHERE event_id = ?;', [eventId]);

    return {
      event: events[0],
      reflection: reflections.length > 0 ? reflections[0] : null,
      tasks: tasks
    };
  } catch (error) {
    console.error('❌ Lỗi lấy chi tiết sự kiện:', error);
    return null;
  }
};

// 4. Lấy danh sách sự kiện đang diễn ra cho Màn hình chính
export const getActiveEventsFromDB = async () => {
  try {
    const db = await getDBConnection();
    const events: any[] = await db.getAllAsync(
      `SELECT * FROM events WHERE status != 'COMPLETED' ORDER BY created_at DESC;`
    );
    return events;
  } catch (error) {
    console.error('❌ Lỗi lấy active events:', error);
    return [];
  }
};

// 5. Lấy lịch sử sự kiện đã hoàn thành
export const getCompletedEventsHistory = async () => {
  try {
    const db = await getDBConnection();
    const result: any[] = await db.getAllAsync(`
      SELECT 
        e.id, 
        e.title, 
        e.category, 
        e.event_date,
        ev.helpfulness_score,
        ev.user_feedback,
        ev.key_takeaways,
        (SELECT COUNT(*) FROM preparation_tasks pt WHERE pt.event_id = e.id AND pt.is_completed = 1) as completed_tasks_count
      FROM events e
      LEFT JOIN evaluations ev ON e.id = ev.event_id
      WHERE e.status = 'COMPLETED'
      ORDER BY e.event_date DESC;
    `);
    return result || [];
  } catch (error) {
    console.error('❌ Lỗi lấy completed events history:', error);
    return [];
  }
};

// src/database/eventService.ts

export const createEventWithActionsFromAI = async (
  title: string, 
  eventDate: string, 
  actions: string[],
  userConcern?: string
) => {
  try {
    const db = await getDBConnection();
    const newEventId = Date.now().toString();
    const formattedDate = formatToStandardDateTime(eventDate);
    
    // 1. Tạo sự kiện chính
    await db.runAsync(
      'INSERT INTO events (id, title, category, event_date, status) VALUES (?, ?, ?, ?, ?);',
      [newEventId, title, 'Other', formattedDate, 'ACTIVE']
    );

    // 2. Tự động chèn mối lo lắng vào bảng reflections (Không cần user nhập lại)
    if (userConcern && userConcern.trim().length > 0) {
      const reflectionId = `ref_${newEventId}`;
      await db.runAsync(
        'INSERT INTO reflections (id, event_id, past_experience) VALUES (?, ?, ?);',
        [reflectionId, newEventId, userConcern]
      );
    }

    // 3. Tự động chèn các bước Action Plan vào bảng preparation_tasks
    if (actions && actions.length > 0) {
      let counter = 0;
      for (const actionTitle of actions) {
        counter++;
        const taskId = `${newEventId}_task_${counter}`;
        await db.runAsync(
          'INSERT INTO preparation_tasks (id, event_id, title, is_completed) VALUES (?, ?, ?, 0);',
          [taskId, newEventId, actionTitle]
        );
      }
    }

    console.log('✅ Đã lưu sự kiện & Action Plan từ AI thành công');
    return newEventId;
  } catch (error) {
    console.error('❌ Lỗi khi lưu sự kiện từ AI:', error);
    throw error;
  }
};