// src/screens/ProfileDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Switch, 
  Alert 
} from 'react-native';
import { getUserSettings, updateUserSettings, UserSettings, deleteAccountAndResetData } from '../database/coachDatabase';

interface ProfileDashboardProps {
  onResetApp?: () => void;
}

export default function ProfileDashboardScreen({ onResetApp }: ProfileDashboardProps) {
  const [profile, setProfile] = useState<UserSettings | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [notiEnabled, setNotiEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await getUserSettings();
    if (data) {
      setProfile(data);
      setFullName(data.full_name || '');
      setOccupation(data.occupation || '');
      setNotiEnabled(data.notifications_enabled === 1);
      setQuietStart(data.quiet_hours_start || '22:00');
      setQuietEnd(data.quiet_hours_end || '07:00');
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateUserSettings({
        full_name: fullName,
        occupation,
        notifications_enabled: notiEnabled ? 1 : 0,
        quiet_hours_start: quietStart,
        quiet_hours_end: quietEnd,
      });
      setIsEditing(false);
      await loadSettings();
      Alert.alert('Thành công', 'Cập nhật thông tin cá nhân thành công!');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể lưu cài đặt.');
    }
  };


  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ XÁC NHẬN XÓA TÀI KHOẢN',
      'Toàn bộ lịch sử trò chuyện, sự kiện, nhiệm vụ và thông tin cá nhân sẽ bị xóa vĩnh viễn. Bạn có chắc chắn không?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa vĩnh viễn', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccountAndResetData();
              Alert.alert('Đã xóa', 'Toàn bộ dữ liệu đã được làm sạch.');
              if (onResetApp) onResetApp();
            } catch (err) {
              Alert.alert('Lỗi', 'Không thể xóa dữ liệu.');
            }
          }
        }
      ]
    );
  };


  const handleUpgradePremium = () => {
    Alert.alert('Nâng cấp PRO ⭐', 'Tính năng Premium đang chuẩn bị mở cổng thanh toán!');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 110 }}>
      {/* Header Profile Badge */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{fullName ? fullName.charAt(0).toUpperCase() : '👤'}</Text>
        </View>
        <Text style={styles.userName}>{fullName || 'Người dùng AI Coach'}</Text>
        <Text style={styles.userRole}>{occupation || 'Chưa cập nhật'}</Text>
        <View style={profile?.is_premium ? styles.proBadge : styles.freeBadge}>
          <Text style={styles.badgeText}>{profile?.is_premium ? '⭐ TÀI KHOẢN PRO' : '🌱 BẢN MIỄN PHÍ'}</Text>
        </View>
      </View>

      {/* Thẻ Premium Promotion */}
      <TouchableOpacity style={styles.premiumCard} onPress={handleUpgradePremium} activeOpacity={0.85}>
        <Text style={styles.premiumTitle}>👑 Nâng cấp AI Coach PRO</Text>
        <Text style={styles.premiumDesc}>
          • Chat Ollama không giới hạn lượt{'\n'}
          • Tự động tối ưu khung giờ yên tĩnh khi nhắc nhở{'\n'}
          • Báo cáo phân tích chuyên sâu hàng tháng
        </Text>
        <View style={styles.upgradeBtn}>
          <Text style={styles.upgradeBtnText}>Nâng cấp ngay</Text>
        </View>
      </TouchableOpacity>

      {/* Thẻ Cài đặt Thông tin Cá nhân */}
      <View style={styles.glassSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👤 Thông tin cá nhân</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Text style={styles.editBtnText}>{isEditing ? 'Hủy' : 'Chỉnh sửa'}</Text>
          </TouchableOpacity>
        </View>

        {isEditing ? (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>Tên hiển thị:</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

            <Text style={styles.label}>Nghề nghiệp:</Text>
            <TextInput style={styles.input} value={occupation} onChangeText={setOccupation} />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
              <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.infoText}>Biệt danh: <Text style={styles.infoValue}>{profile?.full_name}</Text></Text>
            <Text style={styles.infoText}>Công việc: <Text style={styles.infoValue}>{profile?.occupation}</Text></Text>
            <Text style={styles.infoText}>Độ tuổi: <Text style={styles.infoValue}>{profile?.age_group}</Text></Text>
          </View>
        )}
      </View>

      {/* Thẻ Cài đặt Thông báo */}
      <View style={styles.glassSection}>
        <Text style={styles.sectionTitle}>🔔 Cài đặt Thông báo</Text>

        <View style={styles.switchRow}>
          <Text style={styles.labelNoMargin}>Cho phép thông báo nhắc nhở</Text>
          <Switch
            value={notiEnabled}
            onValueChange={(val) => {
              setNotiEnabled(val);
              updateUserSettings({ notifications_enabled: val ? 1 : 0 });
            }}
            trackColor={{ false: '#767577', true: '#80FFB4' }}
            thumbColor={notiEnabled ? '#FFF' : '#f4f3f4'}
          />
        </View>

        <View style={styles.divider} />

        <Text style={[styles.label, { marginTop: 10 }]}>Khung giờ AI được phép gửi thông báo:</Text>
        <Text style={styles.subText}>Action Plan sẽ chỉ được nhắc nhở trong khoảng thời gian này.</Text>

        <View style={styles.timeRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.subLabel}>Từ (Sáng):</Text>
            <TextInput 
              style={styles.inputTime} 
              value={quietStart} 
              onChangeText={setQuietStart} 
              onEndEditing={handleSaveProfile} 
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.subLabel}>Đến (Tối):</Text>
            <TextInput 
              style={styles.inputTime} 
              value={quietEnd} 
              onChangeText={setQuietEnd} 
              onEndEditing={handleSaveProfile} 
            />
          </View>
        </View>
        
        {/* THẺ DANGER ZONE: Nút xóa tài khoản */}
      <View style={[styles.glassSection, { borderColor: 'rgba(255, 99, 71, 0.4)', marginTop: 10 }]}>
        <Text style={[styles.sectionTitle, { color: '#FF6B6B' }]}>🚨 Vùng nguy hiểm</Text>
        <Text style={styles.subText}>Xóa toàn bộ hồ sơ, sự kiện và lịch sử trò chuyện trên máy này.</Text>
        
        <TouchableOpacity 
          style={{
            backgroundColor: 'rgba(255, 99, 71, 0.2)',
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#FF6B6B',
            marginTop: 8
          }} 
          onPress={handleDeleteAccount}
        >
          <Text style={{ color: '#FF6B6B', fontWeight: 'bold', fontSize: 14 }}>🗑️ Xóa tài khoản & Reset App</Text>
        </TouchableOpacity>
      </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 18, paddingTop: 10 },
  profileHeader: { alignItems: 'center', marginBottom: 16 },
  avatarCircle: {
    width: 65,
    height: 65,
    borderRadius: 35,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: '#5C72A8' },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  userRole: { fontSize: 13, color: 'rgba(255, 255, 255, 0.8)', marginTop: 2 },
  proBadge: { backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  freeBadge: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  badgeText: { fontSize: 11, fontWeight: 'bold', color: '#333' },
  premiumCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFD700',
    marginBottom: 16,
  },
  premiumTitle: { fontSize: 16, fontWeight: 'bold', color: '#FFD700', marginBottom: 6 },
  premiumDesc: { fontSize: 12, color: '#FFF', lineHeight: 18, marginBottom: 12 },
  upgradeBtn: { backgroundColor: '#FFD700', paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  upgradeBtnText: { color: '#333', fontWeight: 'bold', fontSize: 13 },
  glassSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#FFF' },
  editBtnText: { color: '#80FFB4', fontWeight: 'bold', fontSize: 13 },
  label: { fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', marginTop: 8, marginBottom: 4 },
  labelNoMargin: { fontSize: 13, color: '#FFF', fontWeight: '500' },
  subText: { fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', marginBottom: 8 },
  infoText: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 13, marginBottom: 4 },
  infoValue: { color: '#FFF', fontWeight: 'bold' },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    padding: 8,
    color: '#FFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  saveBtn: { backgroundColor: '#4A68B1', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)', marginVertical: 8 },
  timeRow: { flexDirection: 'row', marginTop: 4 },
  subLabel: { fontSize: 11, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 2 },
  inputTime: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    padding: 8,
    color: '#FFF',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});