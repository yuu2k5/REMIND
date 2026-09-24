// src/screens/CompletedDashboardScreen.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  RefreshControl, 
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert
} from 'react-native';
import { getCompletedEventsHistory } from '../database/eventService';

const MOTIVATIONAL_QUOTES = [
  " Mỗi trải nghiệm là một bước tiến vượt bậc!",
  " Bạn đã vượt qua chính mình của ngày hôm qua.",
  " Bài học quý giá này sẽ là hành trang tuyệt vời cho tương lai.",
  " Tuyệt vời! Bạn đang duy trì phong độ rất tốt.",
  " Mục tiêu đã hoàn thành, tiếp tục giữ vững ngọn lửa này nhé!"
];

export default function CompletedDashboardScreen() {
  const [completedList, setCompletedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadCompletedData = async () => {
    const data = await getCompletedEventsHistory();
    setCompletedList(data);
    setLoading(false);
  };

  useEffect(() => {
    loadCompletedData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompletedData();
    setRefreshing(false);
  };


  // Lọc danh sách thành tựu dựa trên tên gần đúng
  const filteredList = completedList.filter((item) => 
    item.title ? item.title.toLowerCase().includes(searchTerm.trim().toLowerCase()) : false
  );

  // Hàm chọn ngẫu nhiên câu động viên dựa vào id sự kiện
  const getEncouragement = (id: string) => {
    const index = Math.abs(String(id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
    return MOTIVATIONAL_QUOTES[index % MOTIVATIONAL_QUOTES.length];
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {/* Header Dashboard */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>
             Kho lưu trữ thành tựu <Text style={styles.countBadge}>({filteredList.length})</Text>
          </Text>
          <Text style={styles.headerSub}>Xem lại các bài học đã rút ra</Text>
        </View>

        {/* Box Tìm Kiếm Thành Tựu */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm theo tên thành tựu..."
            placeholderTextColor="rgba(255, 255, 255, 0.55)"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCorrect={false}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Nội dung danh sách */}
        {completedList.length === 0 ? (
          <View style={styles.emptyGlassCard}>
            <Text style={styles.emptyIcon}>🚀</Text>
            <Text style={styles.emptyText}>Chưa có thành tựu nào được lưu trữ.</Text>
            <Text style={styles.emptySubText}>
              Hãy hoàn thành sự kiện và ghi lại bài học để lấp đầy kho thành tựu nhé!
            </Text>
          </View>
        ) : filteredList.length === 0 ? (
          <View style={styles.emptyGlassCard}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={styles.emptyText}>Không tìm thấy thành tựu phù hợp</Text>
            <Text style={styles.emptySubText}>
              Không có sự kiện nào khớp với từ khóa "{searchTerm}"
            </Text>
          </View>
        ) : (
          filteredList.map((item) => (
            <View key={item.id} style={styles.glassCard}>
              {/* Header Card với Nút Xóa */}
              <View style={styles.cardHeader}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                
                <View style={styles.headerRightAction}>
                  
                  
                  
                </View>
              </View>

              <Text style={styles.eventDate}>📅 Ngày hoàn thành: {item.event_date}</Text>
              
              

              {/* Bài học rút ra */}
              {item.key_takeaways ? (
                <View style={styles.takeawayBox}>
                  <Text style={styles.takeawayLabel}>💡 Bài học kinh nghiệm:</Text>
                  <Text style={styles.takeawayContent}>"{item.key_takeaways}"</Text>
                </View>
              ) : null}

              {/* Lời động viên từ AI Coach */}
              <View style={styles.quoteBox}>
                <Text style={styles.quoteText}>{getEncouragement(String(item.id))}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#6C81B8',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 10,
  },
  container: { 
    flex: 1, 
    paddingHorizontal: 18 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#6C81B8' 
  },
  
  // Header Section
  headerSection: {
    marginTop: 20,
    marginBottom: 16,
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  countBadge: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerSub: { 
    fontSize: 14, 
    color: 'rgba(255, 255, 255, 0.75)', 
    marginTop: 4 
  },

  // Search Box
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    height: 46,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    height: '100%',
  },
  clearBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  clearBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    width: 16,
    height: 16,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Empty Card
  emptyGlassCard: { 
    backgroundColor: 'rgba(255, 255, 255, 0.18)', 
    borderRadius: 20, 
    padding: 25, 
    alignItems: 'center', 
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#FFFFFF' 
  },
  emptySubText: { 
    fontSize: 13, 
    color: 'rgba(255, 255, 255, 0.75)', 
    textAlign: 'center', 
    marginTop: 6,
    lineHeight: 18,
  },

  // Glass Card Item
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  eventTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#FFFFFF', 
    flex: 1,
    marginRight: 8,
  },
  headerRightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ratingStars: { 
    fontSize: 13 
  },
  deleteCardBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 99, 71, 0.4)',
  },
  deleteCardIcon: {
    fontSize: 13,
  },
  eventDate: { 
    fontSize: 12, 
    color: 'rgba(255, 255, 255, 0.75)', 
    marginTop: 4 
  },

  // Action Badge
  actionBadge: { 
    backgroundColor: 'rgba(128, 255, 180, 0.2)', 
    paddingHorizontal: 10,
    paddingVertical: 5, 
    borderRadius: 10, 
    alignSelf: 'flex-start', 
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(128, 255, 180, 0.3)',
  },
  actionBadgeText: { 
    fontSize: 12, 
    color: '#B3FFD6', 
    fontWeight: '600' 
  },

  // Takeaway Box
  takeawayBox: { 
    marginTop: 12, 
    backgroundColor: 'rgba(0, 0, 0, 0.15)', 
    padding: 12, 
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FFD700',
  },
  takeawayLabel: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#FFD700' 
  },
  takeawayContent: { 
    fontSize: 13, 
    fontStyle: 'italic', 
    color: '#FFFFFF', 
    marginTop: 4,
    lineHeight: 18,
  },

  // Quote Box
  quoteBox: { 
    marginTop: 12, 
    paddingTop: 8, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255, 255, 255, 0.15)' 
  },
  quoteText: { 
    fontSize: 12, 
    fontWeight: '500', 
    color: 'rgba(255, 255, 255, 0.85)', 
    fontStyle: 'italic' 
  }
});