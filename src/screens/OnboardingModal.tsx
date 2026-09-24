// src/screens/OnboardingModal.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Modal, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { updateUserSettings } from '../database/coachDatabase';

export default function OnboardingModal({ 
  visible, 
  onComplete 
}: { 
  visible: boolean; 
  onComplete: () => void; 
}) {
  const [fullName, setFullName] = useState('');
  const [ageGroup, setAgeGroup] = useState('18-24');
  const [occupation, setOccupation] = useState('');
  const [allowedStart, setAllowedStart] = useState('08:00');
  const [allowedEnd, setAllowedEnd] = useState('21:00');

  const handleFinish = async () => {
    if (!fullName.trim() || !occupation.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên và nghề nghiệp của bạn.');
      return;
    }

    try {
      await updateUserSettings({
        full_name: fullName.trim(),
        age_group: ageGroup,
        occupation: occupation.trim(),
        notifications_enabled: 1,
        quiet_hours_start: allowedStart, // Dùng làm khung giờ bắt đầu
        quiet_hours_end: allowedEnd      // Dùng làm khung giờ kết thúc
      });
      onComplete();
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể lưu thông tin. Vui lòng thử lại.');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.welcomeTitle}>Chào mừng bạn! 👋</Text>
          <Text style={styles.subtitle}>
            Thiết lập hồ sơ để AI Coach lên kế hoạch và gửi thông báo đúng lúc nhất:
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tên / Biệt danh</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: Minh Nam"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nghề nghiệp</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: Lập trình viên..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={occupation}
              onChangeText={setOccupation}
            />
          </View>

          {/* Chọn Khung giờ nhận thông báo */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>🔔 Khung giờ AI được phép gửi thông báo</Text>
            <Text style={styles.subHint}>AI sẽ chỉ nhắc nhở bạn trong khoảng thời gian này.</Text>
            <View style={styles.timeRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.timeSubLabel}>Từ (Sáng):</Text>
                <TextInput
                  style={styles.timeInput}
                  value={allowedStart}
                  onChangeText={setAllowedStart}
                  placeholder="08:00"
                  placeholderTextColor="#AAA"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.timeSubLabel}>Đến (Tối):</Text>
                <TextInput
                  style={styles.timeInput}
                  value={allowedEnd}
                  onChangeText={setAllowedEnd}
                  placeholder="21:00"
                  placeholderTextColor="#AAA"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleFinish}>
            <Text style={styles.submitBtnText}>Bắt đầu trải nghiệm ✨</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5C72A8' },
  content: { padding: 24, justifyContent: 'center' },
  welcomeTitle: { fontSize: 26, fontWeight: 'bold', color: '#FFF', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(255, 255, 255, 0.85)', marginBottom: 20, lineHeight: 18 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, color: '#FFF', fontWeight: '600', marginBottom: 6 },
  subHint: { fontSize: 11, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 10,
    padding: 12,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeSubLabel: { fontSize: 11, color: '#FFF', marginBottom: 4 },
  timeInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: 10,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  submitBtn: {
    backgroundColor: '#4A68B1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
});