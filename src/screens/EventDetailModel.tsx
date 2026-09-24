// src/screens/EventDetailModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  ScrollView,
  SafeAreaView
} from 'react-native';
import { generateReflectionQuestion, generateActionPlan, PlanResult } from '../services/coachService';
import { 
  saveReflectionAndActionPlan, 
  getActionItemsByEvent, 
  toggleActionItemComplete, 
  deleteEvent,
  saveEvaluation,
  getEvaluationByEvent,
  getReflectionByEvent
} from '../database/coachDatabase';
// ✅ IMPORT HÀM CHUẨN TỪ NOTIFICATION SERVICE
import { scheduleActionPlanNotifications } from '../services/notificationService';

export default function EventDetailModal({ 
  event, 
  visible, 
  onClose,
  onEventDeleted 
}: { 
  event: any, 
  visible: boolean, 
  onClose: () => void,
  onEventDeleted?: () => void 
}) {
  const [aiQuestion, setAiQuestion] = useState('');
  const [pastExperience, setPastExperience] = useState('');
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [actionItems, setActionItems] = useState<any[]>([]);

  const [existingReflection, setExistingReflection] = useState<string>('');

  const [isPastEvent, setIsPastEvent] = useState(false);
  const [score, setScore] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [takeaways, setTakeaways] = useState('');
  const [savedEval, setSavedEval] = useState<any>(null);
  const [savingEval, setSavingEval] = useState(false);

  useEffect(() => {
    if (visible && event) {
      checkEventStatusAndLoadData();
    }
  }, [visible, event]);

  const checkEventStatusAndLoadData = async () => {
    setExistingReflection('');
    setPastExperience('');
    setActionItems([]);
    setAiQuestion('');
    if (event?.event_date) {
      const [datePart, timePart] = event.event_date.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = (timePart || '08:00').split(':').map(Number);
      const eventTime = new Date(year, month - 1, day, hours, minutes);
      
      const isPast = new Date() > eventTime;
      setIsPastEvent(isPast);

      if (isPast) {
        const evalData = await getEvaluationByEvent(event.id);
        if (evalData) {
          setSavedEval(evalData);
          setScore(evalData.helpfulness_score);
          setFeedback(evalData.user_feedback);
          setTakeaways(evalData.key_takeaways);
        }
      }
    }

    const items = await getActionItemsByEvent(event.id);
    setActionItems(items);

    try {
      if (getReflectionByEvent) {
        const refData = await getReflectionByEvent(event.id);
        if (refData && refData.past_experience) {
          setExistingReflection(refData.past_experience);
        }
      }
    } catch (e) {
      console.log('Chưa có reflection cũ:', e);
    }

    if (items.length === 0 && !isPastEvent && !existingReflection) {
      setLoadingQuestion(true);
      try {
        const question = await generateReflectionQuestion(event.title, event.category);
        setAiQuestion(question);
      } catch (err) {
        setAiQuestion('Lần trước tham gia sự kiện tương tự, bạn thấy mình cần cải thiện điều gì nhất?');
      } finally {
        setLoadingQuestion(false);
      }
    }
  };

  // ✅ HÀM XỬ LÝ TẠO ACTION PLAN & ĐẶT LỊCH THÔNG BÁO TỰ ĐỘNG
  const handleGeneratePlan = async () => {
    const experienceToUse = pastExperience.trim() || existingReflection;

    if (!experienceToUse) {
      Alert.alert('Thông báo', 'Hãy chia sẻ một chút về trải nghiệm hoặc lỗi sai cũ của bạn.');
      return;
    }

    setGeneratingPlan(true);
    try {
      // 1. AI tạo Action Plan
      const plan: PlanResult = await generateActionPlan(event.title, event.event_date, experienceToUse);

      // 2. Lưu thông tin vào SQLite Database
      await saveReflectionAndActionPlan(event.id, experienceToUse, plan);

      // 3. Tải danh sách item vừa được lưu từ DB
      const newItems = await getActionItemsByEvent(event.id);
      setActionItems(newItems);

      // 4. Lên lịch thông báo thông minh theo Khung giờ cho phép & Hạn chót trước ngày sự kiện
      if (newItems && newItems.length > 0) {
        // Thêm (: any) vào sau biến item
        const formattedActions = newItems.map((item: any) => ({
          id: String(item.id),
          title: item.task_description || '',
          description: item.task_description || ''
        }));

        await scheduleActionPlanNotifications(
          event.title,
          event.event_date,
          formattedActions
        );
      }

      // 5. Cập nhật lại giao diện với mốc giờ đã lên lịch
      const updatedItemsWithTime = await getActionItemsByEvent(event.id);
      setActionItems(updatedItemsWithTime);

    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể tạo Action Plan.');
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleToggleTask = async (item: any) => {
    await toggleActionItemComplete(item.id, item.is_completed);
    const updated = await getActionItemsByEvent(event.id);
    setActionItems(updated);
  };

  const handleSaveEvaluation = async () => {
    if (!takeaways.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập bài học bạn rút ra sau sự kiện.');
      return;
    }

    setSavingEval(true);
    try {
      await saveEvaluation(event.id, score, feedback, takeaways);
      Alert.alert('Thành công', 'Đã lưu đánh giá & bài học kinh nghiệm!');
      const evalData = await getEvaluationByEvent(event.id);
      setSavedEval(evalData);
      if (onEventDeleted) onEventDeleted();
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể lưu đánh giá: ' + err.message);
    } finally {
      setSavingEval(false);
    }
  };

  const handleDeleteEvent = () => {
    const targetId = event?.id || event?._id;
    if (!targetId) {
      Alert.alert('Lỗi', 'Không tìm thấy ID của sự kiện này.');
      return;
    }

    Alert.alert(
      'Xóa sự kiện',
      `Bạn có chắc chắn muốn xóa "${event.title}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(targetId);
              if (onEventDeleted) onEventDeleted();
              onClose();
            } catch (err: any) {
              Alert.alert('Lỗi', 'Không thể xóa sự kiện: ' + err.message);
            }
          },
        },
      ]
    );
  };

  const completedCount = actionItems.filter(i => i.is_completed === 1).length;
  const totalCount = actionItems.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (!event) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container}>
          
          {/* Top Bar Header */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteEvent}>
              <Text style={styles.deleteBtnText}>🗑️ Xóa</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕ Đóng</Text>
            </TouchableOpacity>
          </View>

          {/* Chi tiết Sự kiện */}
          <View style={styles.eventInfoCard}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventSub}>
              🕒 Thời gian: {event.event_date} {isPastEvent ? ' (Đã kết thúc)' : ''}
            </Text>
          </View>

          {/* TRƯỜNG HỢP 1: SỰ KIỆN ĐÃ KẾT THÚC */}
          {isPastEvent ? (
            <View style={styles.glassBox}>
              <Text style={styles.boxHeader}>📝 Đánh Giá & Rút Kinh Nghiệm</Text>

              {savedEval ? (
                <View style={styles.savedEvalCard}>
                  <Text style={styles.evalLabel}>Cảm nhận: <Text style={styles.evalValue}>{savedEval.user_feedback || 'Khởi chạy tốt'}</Text></Text>
                  <Text style={styles.evalLabel}>Bài học rút ra:</Text>
                  <Text style={styles.takeawayText}>"{savedEval.key_takeaways}"</Text>
                </View>
              ) : (
                <View>
                  <Text style={styles.label}>1. Bạn thấy sự kiện diễn ra như thế nào?</Text>
                  <TextInput
                    style={styles.input}
                    value={feedback}
                    onChangeText={setFeedback}
                  />

                  <Text style={styles.label}>2. Bài học quan trọng nhất cho những lần sau là gì?</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                    multiline
                    value={takeaways}
                    onChangeText={setTakeaways}
                  />

                  <TouchableOpacity 
                    style={styles.primaryBtn} 
                    onPress={handleSaveEvaluation}
                    disabled={savingEval}
                  >
                    {savingEval ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Lưu Đánh Giá & Hoàn Tất</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            /* TRƯỜNG HỢP 2 & 3: SỰ KIỆN SẮP TỚI */
            actionItems.length === 0 ? (
              <View style={styles.glassBox}>
                {existingReflection ? (
                  <View style={styles.reflectionNoteCard}>
                    <Text style={styles.boxHeader}>💭 Mối lo lắng đã chia sẻ với AI:</Text>
                    <Text style={styles.reflectionNoteText}>"{existingReflection}"</Text>
                    
                    <TouchableOpacity 
                      style={[styles.primaryBtn, { marginTop: 15 }]} 
                      onPress={handleGeneratePlan}
                      disabled={generatingPlan}
                    >
                      {generatingPlan ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>⚡ Tự động tạo Action Plan từ mối lo này</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    {loadingQuestion ? (
                      <ActivityIndicator color="#FFF" style={{ marginVertical: 15 }} />
                    ) : (
                      <View style={styles.questionBubble}>
                        <Text style={styles.questionText}>"{aiQuestion}"</Text>
                      </View>
                    )}

                    <TextInput
                      style={styles.experienceInput}
                      placeholder="Chia sẻ điều bạn còn tiếc nuối hoặc lo lắng ở đây..."
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      multiline
                      numberOfLines={4}
                      value={pastExperience}
                      onChangeText={setPastExperience}
                    />

                    <TouchableOpacity 
                      style={styles.primaryBtn} 
                      onPress={handleGeneratePlan}
                      disabled={generatingPlan}
                      activeOpacity={0.8}
                    >
                      {generatingPlan ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Phân tích & Tạo Action Plan</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              /* TRƯỜNG HỢP 3: ĐÃ CÓ ACTION PLAN */
              <View style={styles.glassBox}>
                <Text style={[styles.boxHeader, { color: '#fff', textAlign: 'center' }]}>📋 ACTION PLAN</Text>
                
                {existingReflection ? (
                  <View style={styles.miniReflectionCard}>
                    <Text style={styles.miniReflectionLabel}>Mối lo lắng ban đầu:</Text>
                    <Text style={styles.miniReflectionText}>"{existingReflection}"</Text>
                  </View>
                ) : null}

                <View style={styles.progressContainer}>
                  <View style={styles.progressTextRow}>
                    <Text style={styles.progressLabel}>Tiến độ chuẩn bị:</Text>
                    <Text style={styles.progressPercent}>{completedCount}/{totalCount} ({progressPercent}%)</Text>
                  </View>
                  <View style={styles.progressBarBackground}>
                    <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                  </View>
                </View>

                {actionItems.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={[styles.taskCard, item.is_completed === 1 && styles.taskCompleted]}
                    onPress={() => handleToggleTask(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.checkbox}>{item.is_completed === 1 ? '✅' : '🔲'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskText, item.is_completed === 1 && styles.strikethrough]}>
                        {item.task_description}
                      </Text>
                      {item.scheduled_time ? (
                        <Text style={styles.taskTime}>⏰ Nhắc nhở: {item.scheduled_time}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const extraStyles = StyleSheet.create({
  reflectionNoteCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  reflectionNoteText: {
    color: '#E2E8F0',
    fontStyle: 'italic',
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  miniReflectionCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 5,
  },
  miniReflectionLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 'bold',
  },
  miniReflectionText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontStyle: 'italic',
    marginTop: 2,
  }
});

const styles = StyleSheet.create({
  ...extraStyles,
  safeArea: { flex: 1, backgroundColor: '#5C72A8' },
  container: { padding: 18, backgroundColor: '#5C72A8', flexGrow: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(255, 99, 71, 0.25)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 99, 71, 0.4)' },
  deleteBtnText: { fontSize: 13, color: '#FFD1D1', fontWeight: 'bold' },
  closeBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 20 },
  closeBtnText: { fontSize: 14, color: '#FFF', fontWeight: 'bold' },
  eventInfoCard: { backgroundColor: 'rgba(255, 255, 255, 0.18)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
  eventTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 6 },
  eventSub: { fontSize: 13, color: 'rgba(255, 255, 255, 0.8)' },
  glassBox: { backgroundColor: 'rgba(255, 255, 255, 0.22)', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.35)' },
  boxHeader: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF' },
  questionBubble: { backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: 14, borderRadius: 14, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#A5C0FF' },
  questionText: { fontSize: 14, color: '#FFFFFF', fontStyle: 'italic', lineHeight: 20 },
  experienceInput: { backgroundColor: 'rgba(0, 0, 0, 0.15)', padding: 12, borderRadius: 12, fontSize: 14, color: '#FFF', minHeight: 85, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  primaryBtn: { backgroundColor: '#4A68B1', paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  progressContainer: { backgroundColor: 'rgba(0, 0, 0, 0.15)', padding: 12, borderRadius: 12, marginVertical: 14 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: 'rgba(255, 255, 255, 0.9)' },
  progressPercent: { fontSize: 13, fontWeight: 'bold', color: '#80FFB4' },
  progressBarBackground: { height: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#80FFB4', borderRadius: 4 },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.18)', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)' },
  taskCompleted: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)' },
  checkbox: { fontSize: 18, marginRight: 10 },
  taskText: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  strikethrough: { textDecorationLine: 'line-through', color: 'rgba(255, 255, 255, 0.5)' },
  taskTime: { fontSize: 11, color: 'rgba(255, 255, 255, 0.7)', marginTop: 3 },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: 'rgba(0, 0, 0, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 10, padding: 10, fontSize: 14, color: '#FFF', marginBottom: 10 },
  savedEvalCard: { backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: 14, borderRadius: 12 },
  evalLabel: { fontSize: 13, fontWeight: 'bold', color: '#FFF', marginBottom: 4 },
  evalValue: { fontWeight: 'normal', color: 'rgba(255, 255, 255, 0.85)' },
  takeawayText: { fontSize: 13, fontStyle: 'italic', color: '#E0E7FF', marginTop: 4 }
});