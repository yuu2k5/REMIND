// src/screens/AddEventScreen.tsx
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { parseEventFromText, ParsedEvent } from '../services/eventParser';
import { saveEventToDB } from '../database/eventService';

export default function AddEventScreen({ onEventSaved }: { onEventSaved: () => void }) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsedEvent, setParsedEvent] = useState<ParsedEvent | null>(null);

  // Gửi văn bản cho AI bóc tách
  const handleProcessAI = async () => {
    if (!inputText.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập nội dung sự kiện hoặc ý định của bạn.');
      return;
    }

    setLoading(true);
    try {
      const result = await parseEventFromText(inputText);
      setParsedEvent(result);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Xác nhận và Lưu vào SQLite Database
  const handleSaveEvent = async () => {
    if (!parsedEvent) return;

    setSaving(true);
    try {
      await saveEventToDB(parsedEvent);
      Alert.alert('Thành công', 'Đã lưu sự kiện vào lịch trình!');
      setInputText('');
      setParsedEvent(null);
      onEventSaved(); // Reload lại danh sách ở App.tsx
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể lưu sự kiện: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}> Xin chào </Text>
      
      {/* Ô nhập liệu Text / Voice qua Bàn Phím */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Hãy bắt đầu chia sẻ dự định của bạn ở đây..."
          placeholderTextColor="#888"
          multiline
          numberOfLines={3}
          value={inputText}
          onChangeText={setInputText}
        />
      </View>

      {/* Nút Phân Tích AI */}
      <TouchableOpacity 
        style={[styles.processButton, loading && styles.disabledBtn]} 
        onPress={handleProcessAI} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.processButtonText}> Phân tích </Text>
        )}
      </TouchableOpacity>

      {/* Kết Quả AI Bóc Tách (Xem trước) */}
      {parsedEvent && (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Kết quả phân tích:</Text>
          <Text style={styles.previewText}><Text style={styles.bold}>Tên sự kiện:</Text> {parsedEvent.title}</Text>
          <Text style={styles.previewText}><Text style={styles.bold}>Phân loại:</Text> {parsedEvent.category}</Text>
          <Text style={styles.previewText}><Text style={styles.bold}>Thời gian:</Text> {parsedEvent.event_date}</Text>
          <Text style={styles.previewText}><Text style={styles.bold}>Tóm tắt:</Text> {parsedEvent.summary}</Text>

          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.disabledBtn]} 
            onPress={handleSaveEvent}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Xác nhận & Lưu Lịch</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#fff', textAlign: 'left' },
  inputContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#e1e4e8', marginBottom: 15 },
  textInput: { fontSize: 15, minHeight: 90, textAlignVertical: 'top', color: '#333' },
  noteText: { fontSize: 12, color: '#666', marginTop: 8, fontStyle: 'italic' },
  processButton: { backgroundColor: '#rgba(255, 255, 255, 0.22)', padding: 15, borderRadius: 10, alignItems: 'center' },
  processButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  disabledBtn: { opacity: 0.6 },
  previewCard: { marginTop: 20, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#rgba(255, 255, 255, 0.22)'},
  previewTitle: { fontSize: 16, fontWeight: 'bold', color: '#666', marginBottom: 10, textAlign: 'justify' },
  previewText: { fontSize: 14, marginBottom: 5, color: '#444' },
  bold: { fontWeight: 'bold' },
  saveButton: { marginTop: 15, backgroundColor: '#0969da', padding: 12, borderRadius: 8, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: 'bold' }
});