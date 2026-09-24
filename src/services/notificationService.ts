// src/services/notificationService.ts
import * as Notifications from 'expo-notifications';
import { getUserSettings, updateActionItemScheduledTime } from '../database/coachDatabase';
// Cấu hình cách hiển thị thông báo khi app đang mở (Chuẩn SDK mới)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Xin quyền thông báo từ người dùng
export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('⚠️ Người dùng chưa cấp quyền thông báo!');
    return false;
  }
  return true;
}

/**
 * Đặt lịch thông báo theo mốc thời gian (Chuỗi YYYY-MM-DD HH:mm)
 */
export async function scheduleTaskNotification(
  eventId: string,
  title: string, 
  taskDescription: string, 
  triggerDate: Date
) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  const now = new Date();
  if (triggerDate.getTime() <= now.getTime()) {
    console.log(`⏰ Thời gian thông báo (${triggerDate.toLocaleString()}) ở quá khứ, bỏ qua.`);
    return null;
  }

  const secondsUntilTrigger = Math.max(1, Math.floor((triggerDate.getTime() - now.getTime()) / 1000));

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔔 ${title}`,
        body: taskDescription,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { eventId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilTrigger,
        repeats: false,
      },
    });

    console.log(`✅ Lên lịch: "${title}" vào lúc ${triggerDate.toLocaleString('vi-VN')}`);
    return notificationId;
  } catch (error) {
    console.error('❌ Lỗi đặt lịch thông báo:', error);
    return null;
  }
}

interface ActionItem {
  id: string;
  title: string;
  description?: string;
}

interface ActionItem {
  id: string;
  title: string;
  description?: string;
}

/**
 * Phân bổ và đặt lịch thông báo tự động cho danh sách Action Plan
 * @param eventTitle Tên sự kiện chính
 * @param eventTimeStr Thời gian diễn ra sự kiện (YYYY-MM-DD HH:mm)
 * @param actionList Danh sách các action cần thực hiện
 */

export async function scheduleActionPlanNotifications(
  eventTitle: string,
  eventTimeStr: string,
  actionList: ActionItem[]
) {
  if (!actionList || actionList.length === 0) return;

  // 1. Lấy cài đặtQuiet Hours
  const settings = await getUserSettings();
  if (settings && settings.notifications_enabled === 0) return;

  const rawStart = (settings?.quiet_hours_start || '08:00').trim();
  const rawEnd = (settings?.quiet_hours_end || '21:00').trim();

  const parseTimeStr = (timeStr: string) => {
    const parts = timeStr.split(':').map(p => parseInt(p, 10));
    return {
      h: isNaN(parts[0]) ? 8 : parts[0],
      m: isNaN(parts[1]) ? 0 : parts[1]
    };
  };

  const startConfig = parseTimeStr(rawStart);
  const endConfig = parseTimeStr(rawEnd);

  // 2. Chuyển đổi mốc thời gian sự kiện
  const [datePart, timePart] = eventTimeStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = (timePart || '08:00').split(':').map(Number);
  
  const eventDate = new Date(year, month - 1, day, hours, minutes);
  const now = new Date();

  // Mốc hạn chót hoàn thành action plan: 23:59:59 của NÀY TRƯỚC ngày sự kiện (Ngày 21)
  const deadlineDate = new Date(eventDate);
  deadlineDate.setDate(deadlineDate.getDate() - 1);
  deadlineDate.setHours(23, 59, 59, 999);

  // Mốc bắt đầu tính ngày (Hôm nay: Ngày 20)
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());

  // Tính chính xác số ngày khả dụng (VD: 20 -> 21 = 2 ngày khả dụng: Ngày 20 và Ngày 21)
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDaysAvailable = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / msPerDay) + 1);

  // 3. Tính số task trung bình mỗi ngày để rải đều
  const totalActions = actionList.length;
  // Số việc mỗi ngày (chia đều, làm tròn lên)
  const baseActionsPerDay = Math.ceil(totalActions / totalDaysAvailable);

  let currentActionIndex = 0;

  for (let dayOffset = 0; dayOffset < totalDaysAvailable && currentActionIndex < totalActions; dayOffset++) {
    const currentDay = new Date(startDay);
    currentDay.setDate(currentDay.getDate() + dayOffset);

    // Mốc thời gian được phép đặt chuông trong ngày này
    const windowStart = new Date(currentDay);
    windowStart.setHours(startConfig.h, startConfig.m, 0, 0);

    const windowEnd = new Date(currentDay);
    windowEnd.setHours(endConfig.h, endConfig.m, 0, 0);

    // Tính số công việc sẽ xếp vào ngày hôm nay
    const remainingActions = totalActions - currentActionIndex;
    const remainingDays = totalDaysAvailable - dayOffset;
    const actionsTodayCount = Math.min(remainingActions, Math.ceil(remainingActions / remainingDays));

    const windowDurationMs = Math.max(1000, windowEnd.getTime() - windowStart.getTime());
    const stepMs = windowDurationMs / (actionsTodayCount + 1);

    for (let k = 0; k < actionsTodayCount; k++) {
      let actionTime = new Date(windowStart.getTime() + stepMs * (k + 1));

      // Ép kẹp biên trong khoảng 07:00 -> 21:00
      if (actionTime.getTime() < windowStart.getTime()) {
        actionTime = new Date(windowStart.getTime());
      }
      if (actionTime.getTime() > windowEnd.getTime()) {
        actionTime = new Date(windowEnd.getTime());
      }

      // Nếu mốc này nằm ở quá khứ của hôm nay -> dời về sau hiện tại 15 phút
      if (actionTime.getTime() <= now.getTime()) {
        actionTime = new Date(now.getTime() + (k + 1) * 15 * 60 * 1000);
      }

      const action = actionList[currentActionIndex];

      // Đặt lịch thông báo
      await scheduleTaskNotification(
        action.id,
        `[${eventTitle}] ${action.title}`,
        action.description || `Đã đến giờ thực hiện: ${action.title}`,
        actionTime
      );

      // Cập nhật mốc giờ chuẩn YYYY-MM-DD HH:mm
      const formattedScheduledTime = `${actionTime.getFullYear()}-${String(actionTime.getMonth() + 1).padStart(2, '0')}-${String(actionTime.getDate()).padStart(2, '0')} ${String(actionTime.getHours()).padStart(2, '0')}:${String(actionTime.getMinutes()).padStart(2, '0')}`;
      
      await updateActionItemScheduledTime(action.id, formattedScheduledTime);

      currentActionIndex++;
    }
  }
}