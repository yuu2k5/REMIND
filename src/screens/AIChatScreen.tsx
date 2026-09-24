// src/screens/AIChatScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  Modal,
  Alert
} from 'react-native';
import { getCompletedEventsHistory, createEventWithActionsFromAI } from '../database/eventService';
import { parseEventFromText } from '../services/eventParser';
import { generateActionPlan } from '../services/coachService';
import { queryOllamaCoach, ChatState } from '../services/ollamaService';
import {
  getChatSessions,
  createChatSession,
  getMessagesBySessionId,
  saveChatMessage,
  updateChatSessionTitle,
  deleteChatSession,
  ChatSession,
  ChatMessage
} from '../database/coachDatabase';

interface Message extends ChatMessage {
  isActionConfirm?: boolean;
}

export default function AIChatScreen({ onEventCreated }: { onEventCreated?: () => void }) {
  // SQLite & Session States
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Quản lý Trạng thái Luồng 4 Bước
  const [currentState, setCurrentState] = useState<ChatState>('STEP_1_EVENT_RECEIVED');
  const [sessionContext, setSessionContext] = useState<{
    eventTitle: string;
    eventDate: string;
    userConcern: string;
    pastLessons: string[];
  }>({
    eventTitle: '',
    eventDate: '',
    userConcern: '',
    pastLessons: []
  });

  const flatListRef = useRef<FlatList>(null);

  // Khởi tạo Chat Sessions từ SQLite khi mở App
  useEffect(() => {
    initChat();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);

  const initChat = async () => {
    const list = await getChatSessions();
    setSessions(list);
    if (list.length > 0) {
      loadSession(list[0].id);
    } else {
      handleNewChat();
    }
  };

  const loadSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    const msgs = await getMessagesBySessionId(sessionId);
    setMessages(msgs);
    setShowHistoryModal(false);
  };

  const handleNewChat = async () => {
    const newId = await createChatSession('Cuộc trò chuyện mới');
    const updatedList = await getChatSessions();
    setSessions(updatedList);
    setCurrentSessionId(newId);
    
    // Tin nhắn chào mừng ban đầu
    const welcomeMsg: Message = {
      id: 'welcome_' + Date.now(),
      session_id: newId,
      sender: 'ai',
      text: 'Xin chào! Bạn sắp có kế hoạch hay bài kiểm tra/sự kiện gì mới? Hãy chia sẻ với mình nhé!'
    };
    
    setMessages([welcomeMsg]);
    await saveChatMessage(newId, 'ai', welcomeMsg.text);
    
    // Reset state luồng 4 bước
    setCurrentState('STEP_1_EVENT_RECEIVED');
    setSessionContext({ eventTitle: '', eventDate: '', userConcern: '', pastLessons: [] });
    setShowHistoryModal(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteChatSession(sessionId);
    const updated = await getChatSessions();
    setSessions(updated);
    if (sessionId === currentSessionId) {
      if (updated.length > 0) {
        loadSession(updated[0].id);
      } else {
        handleNewChat();
      }
    }
  };

  // Xử lý gửi tin nhắn chính (Kết hợp Luồng 4 Bước + Lưu SQLite)
  const handleSend = async () => {
    if (!inputText.trim() || !currentSessionId || isTyping) return;

    const userMsgText = inputText.trim();
    const userMsg: Message = {
      id: 'usr_' + Date.now(),
      session_id: currentSessionId,
      sender: 'user',
      text: userMsgText
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputText('');
    setIsTyping(true);

    // Lưu tin nhắn User vào SQLite
    await saveChatMessage(currentSessionId, 'user', userMsgText);

    // Đổi tên Session thành câu hỏi đầu tiên của User
    if (messages.length <= 1) {
      const shortTitle = userMsgText.length > 25 ? userMsgText.substring(0, 25) + '...' : userMsgText;
      await updateChatSessionTitle(currentSessionId, shortTitle);
      setSessions(await getChatSessions());
    }

    try {
      let aiReplyText = '';
      let isActionConfirm = false;

      // --- BƯỚC 1: Rút trích sự kiện & Tìm bài học cũ ---
      if (currentState === 'STEP_1_EVENT_RECEIVED') {
        const parsed = await parseEventFromText(userMsgText);
        const history = await getCompletedEventsHistory();

        const matchedEvents = history.filter(
          (item) =>
            item.title &&
            (userMsgText.toLowerCase().includes(item.title.toLowerCase()) ||
              item.title.toLowerCase().includes(parsed.title.toLowerCase()))
        );

        const lessons = matchedEvents
          .map((e) => e.key_takeaways)
          .filter((l): l is string => Boolean(l && l.trim().length > 0));

        const updatedContext = {
          ...sessionContext,
          eventTitle: parsed.title || userMsgText,
          eventDate: parsed.event_date || '',
          pastLessons: lessons
        };
        setSessionContext(updatedContext);

        aiReplyText = await queryOllamaCoach(updatedHistory, {
          currentState: 'STEP_1_EVENT_RECEIVED',
          eventTitle: updatedContext.eventTitle,
          pastLessons: lessons
        });

        setCurrentState('STEP_2_ANALYZE_CONCERN');
      }

      // --- BƯỚC 2: Tâm sự mối lo lắng ---
      else if (currentState === 'STEP_2_ANALYZE_CONCERN') {
        const updatedContext = { ...sessionContext, userConcern: userMsgText };
        setSessionContext(updatedContext);

        aiReplyText = await queryOllamaCoach(updatedHistory, {
          currentState: 'STEP_2_ANALYZE_CONCERN',
          eventTitle: updatedContext.eventTitle,
          pastLessons: updatedContext.pastLessons
        });

        setCurrentState('STEP_3_ASK_CONFIRMATION');
      }

      // BƯỚC 3: User cung cấp / xác nhận mốc ngày giờ
      else if (currentState === 'STEP_3_ASK_CONFIRMATION') {
        // ✅ Giữ lại eventDate đã bóc tách từ Bước 1 nếu Bước 3 user chỉ nhắn tin nhắn xác nhận/lo lắng
        const finalDate = sessionContext.eventDate ? sessionContext.eventDate : userMsgText;
        
        const updatedContext = { ...sessionContext, eventDate: finalDate };
        setSessionContext(updatedContext);

        const aiReply = await queryOllamaCoach(updatedHistory, {
          currentState: 'STEP_3_ASK_CONFIRMATION',
          eventTitle: updatedContext.eventTitle
        });

        const aiMsg: Message = {
          id: 'ai_' + Date.now(),
          session_id: currentSessionId!,
          sender: 'ai',
          text: aiReplyText,
          isActionConfirm: true
        };

        // Lưu vào state và SQLite
        setMessages((prev) => [...prev, aiMsg]);
        await saveChatMessage(currentSessionId!, 'ai', aiReplyText);

        setCurrentState('STEP_4_CREATE_ACTION_PLAN');
      }


      // --- BƯỚC 4: Tạo lịch & Action Plan ---
      else if (currentState === 'STEP_4_CREATE_ACTION_PLAN') {
        const confirmKeywords = ['có', 'tạo', 'đồng ý', 'ok', 'giúp', 'được', 'yes', 'tạo lịch'];
        const isAgreed = confirmKeywords.some((k) => userMsgText.toLowerCase().includes(k));

        if (isAgreed) {
          const plan = await generateActionPlan(
            sessionContext.eventTitle,
            sessionContext.eventDate || 'Thời gian tới',
            sessionContext.userConcern
          );
          
          const generatedActions = plan.action_items.map((item) => item.task_description);

          await createEventWithActionsFromAI(
            sessionContext.eventTitle,
            sessionContext.eventDate,
            generatedActions,
            sessionContext.userConcern
          );

          aiReplyText = await queryOllamaCoach(updatedHistory, {
            currentState: 'STEP_4_CREATE_ACTION_PLAN',
            eventTitle: sessionContext.eventTitle
          });

          if (onEventCreated) onEventCreated();
        } else {
          aiReplyText = 'Dạ vâng, mình đã hủy yêu cầu tạo lịch. Bạn cần hỗ trợ gì thêm cứ nhắn mình nhé!';
        }

        setCurrentState('STEP_1_EVENT_RECEIVED');
      }

      // Hiển thị & Lưu tin nhắn AI vào SQLite
      const aiMsg: Message = {
        id: 'ai_' + Date.now(),
        session_id: currentSessionId,
        sender: 'ai',
        text: aiReplyText,
        isActionConfirm
      };

      setMessages((prev) => [...prev, aiMsg]);
      await saveChatMessage(currentSessionId, 'ai', aiReplyText);

    } catch (error) {
      console.error('❌ Lỗi Chat Flow:', error);
      Alert.alert('Lỗi', 'Không thể kết nối với AI Coach.');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        {/* HEADER GEMINI STYLE */}
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.historyBtn} onPress={() => setShowHistoryModal(true)}>
            <Text style={styles.historyBtnText}>🕒 Lịch sử</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            {sessions.find((s) => s.id === currentSessionId)?.title || 'AI Coach'}
          </Text>

          <TouchableOpacity style={styles.newChatBtn} onPress={handleNewChat}>
            <Text style={styles.newChatText}>+ Mới</Text>
          </TouchableOpacity>
        </View>

        {/* CHAT MESSAGES LIST */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatContent}
          renderItem={({ item }) => {
            const isAI = item.sender === 'ai';
            return (
              <View style={[styles.messageRow, isAI ? styles.aiRow : styles.userRow]}>
                {isAI && <Text style={styles.avatar}>🐿️</Text>}
                <View style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble]}>
                  <Text style={styles.messageText}>{item.text}</Text>

                  {item.isActionConfirm && currentState === 'STEP_4_CREATE_ACTION_PLAN' && (
                    <TouchableOpacity
                      style={styles.confirmBtn}
                      onPress={() => {
                        setInputText('Tạo lịch giúp mình nhé');
                        handleSend();
                      }}
                    >
                      <Text style={styles.confirmBtnText}>⚡ Tạo lịch & Action Plan giúp mình</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />

        {isTyping && (
          <View style={styles.typingContainer}>
            <Text style={styles.avatar}>🐿️</Text>
            <View style={[styles.bubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          </View>
        )}

        {/* INPUT BAR */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="rgba(255, 255, 255, 0.55)"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.sendIcon}>🚀</Text>
          </TouchableOpacity>
        </View>

        {/* MODAL LỊCH SỬ CHAT */}
        <Modal visible={showHistoryModal} animationType="slide" transparent>
          <SafeAreaView style={styles.modalBg}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Lịch sử trò chuyện</Text>
                <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                  <Text style={styles.closeBtn}>✕ Đóng</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.createSessionBtn} onPress={handleNewChat}>
                <Text style={styles.createSessionText}>+ Bắt đầu cuộc trò chuyện mới</Text>
              </TouchableOpacity>

              <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.sessionItem, item.id === currentSessionId && styles.activeSessionItem]}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => loadSession(item.id)}>
                      <Text style={styles.sessionTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.sessionDate}>{new Date(item.updated_at).toLocaleDateString('vi-VN')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteSession(item.id)}>
                      <Text style={{ color: '#FF6B6B', paddingLeft: 10 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          </SafeAreaView>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#6C81B8', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 10 },
  container: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  historyBtn: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  historyBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontWeight: 'bold', fontSize: 15, marginHorizontal: 8 },
  newChatBtn: { backgroundColor: '#80FFB4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  newChatText: { color: '#333', fontWeight: 'bold', fontSize: 12 },
  chatContent: { paddingHorizontal: 16, paddingBottom: 20 },
  messageRow: { flexDirection: 'row', marginVertical: 6, alignItems: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  avatar: { fontSize: 26, marginRight: 6, marginBottom: 4 },
  bubble: { maxWidth: '82%', borderRadius: 18, padding: 12 },
  aiBubble: { backgroundColor: 'rgba(255, 255, 255, 0.22)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.35)', borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: '#4E6CB5', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)', borderBottomRightRadius: 4 },
  messageText: { fontSize: 14, lineHeight: 20, color: '#FFFFFF' },
  confirmBtn: { marginTop: 10, backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center' },
  confirmBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
  typingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  inputContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(0, 0, 0, 0.15)', borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', marginBottom: Platform.OS === 'ios' ? 80 : 70 },
  textInput: { flex: 1, height: 44, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 22, paddingHorizontal: 16, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
  sendButton: { marginLeft: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: '#4E6CB5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)' },
  sendIcon: { fontSize: 18 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { flex: 1, backgroundColor: '#4A5B8C', padding: 20, marginTop: 50, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  createSessionBtn: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  createSessionText: { color: '#FFF', fontWeight: 'bold' },
  sessionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 14, borderRadius: 12, marginBottom: 10 },
  activeSessionItem: { borderLeftWidth: 4, borderLeftColor: '#80FFB4', backgroundColor: 'rgba(255,255,255,0.2)' },
  sessionTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  sessionDate: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
});