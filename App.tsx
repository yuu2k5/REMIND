// App.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  RefreshControl, 
  ActivityIndicator, 
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';

import { getDBConnection } from './src/database/schema';
import { getActiveEventsFromDB } from './src/database/eventService';
import AddEventScreen from './src/screens/AddEventScreen';
import EventDetailModal from './src/screens/EventDetailModel';
import CompletedDashboardScreen from './src/screens/CompletedDashboardScreen';
import AIChatScreen from './src/screens/AIChatScreen';
import OnboardingModal from './src/screens/OnboardingModal';
import ProfileDashboardScreen from './src/screens/ProfileDashboardScreen';
import { getUserSettings } from './src/database/coachDatabase';

type TabType = 'HOME' | 'ACHIEVEMENTS' | 'STORE' | 'PROFILE';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('HOME');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    async function prepareDatabase() {
      try {
        await getDBConnection();
        await loadActiveEvents();

        // Kiểm tra xem đã Onboard chưa
        const user = await getUserSettings();
        if (!user || user.is_onboarded === 0) {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error('❌ Lỗi khởi tạo DB:', error);
      } finally {
        setDbReady(true);
      }
    }
    prepareDatabase();
  }, []);

  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as { eventId?: string };
      if (data?.eventId) {
        try {
          const events = await getActiveEventsFromDB();
          const targetEvent = events.find((e: any) => String(e.id) === String(data.eventId));
          if (targetEvent) {
            setSelectedEvent(targetEvent);
            setModalVisible(true);
          }
        } catch (error) {
          console.error('❌ Lỗi Notification:', error);
        }
      }
    });

    return () => responseListener.remove();
  }, []);

  const loadActiveEvents = async () => {
    try {
      const events = await getActiveEventsFromDB();
      setEventsList(events);
    } catch (error) {
      console.error('❌ Lỗi lấy sự kiện:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActiveEvents();
    setRefreshing(false);
  };

  if (!dbReady) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.mainContainer}>

        {/* Modal Onboarding hiển thị lần đầu */}
        <OnboardingModal 
          visible={showOnboarding} 
          onComplete={() => setShowOnboarding(false)} 
        />
        
        {/* TAB 1: DASHBOARD TẠO SỰ KIỆN */}
        {activeTab === 'HOME' && (
          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={{ paddingBottom: 110 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
          >
            {/* Header Mascot */}
            <View style={styles.headerSection}>
              
            </View>

            {/* Ô Nhập Dữ Liệu Tạo Sự Kiện */}
            <AddEventScreen onEventSaved={loadActiveEvents} />

            {/* Danh Sách Kết Quả Sự Kiện */}
            <View style={styles.listSection}>
              <View style={styles.listHeaderRow}>
                <Text style={styles.sectionTitle}>
                  Lịch trình dự định <Text style={styles.eventCount}>({eventsList.length})</Text>
                </Text>
              </View>

              {eventsList.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>Chưa có sự kiện nào đang diễn ra.</Text>
                </View>
              ) : (
                eventsList.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={styles.glassCard}
                    onPress={() => {
                      setSelectedEvent(item);
                      setModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardMain}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      <Text style={styles.cardSub} numberOfLines={1}>
                        {item.event_date || 'Chạm để xem Action Plan...'}
                      </Text>
                    </View>
                    <Text style={styles.arrowIcon}>›</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {/* TAB 2: DASHBOARD KHO LƯU TRỮ THÀNH TỰU */}
        {activeTab === 'ACHIEVEMENTS' && (
          <CompletedDashboardScreen />
        )}

        {activeTab === 'STORE' && (
          <AIChatScreen onEventCreated={loadActiveEvents} />
        )}

        {activeTab === 'PROFILE' && (
          <ProfileDashboardScreen />
        )}

        {/* Modal AI Coach */}
        <EventDetailModal 
          event={selectedEvent}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onEventDeleted={loadActiveEvents} 
        />

        {/* BOTTOM NAVIGATION BAR 4 ICON PHONG CÁCH FIGMA */}
        <View style={styles.bottomBarWrapper}>
          <View style={styles.pillBottomBar}>
            {/* Tab 1: Home (Sự kiện đang chờ) */}
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'HOME' ? styles.activeTabPill : null]}
              onPress={() => {
                setActiveTab('HOME');
                loadActiveEvents();
              }}
            >
              <Text style={styles.tabIcon}>🏠</Text>
            </TouchableOpacity>

            {/* Tab 2: Thành tựu / Quả sồi (Kho lưu trữ) */}
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'ACHIEVEMENTS' ? styles.activeTabPill : null]}
              onPress={() => setActiveTab('ACHIEVEMENTS')}
            >
              <Text style={styles.tabIcon}>🏆</Text>
            </TouchableOpacity>

            {/* Tab 3: Cửa hàng / AI Coach */}
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'STORE' ? styles.activeTabPill : null]}
              onPress={() => setActiveTab('STORE')}
            >
              <Text style={styles.tabIcon}>🤖</Text>
            </TouchableOpacity>

            {/* Tab 4: Cá nhân */}
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'PROFILE' ? styles.activeTabPill : null]}
              onPress={() => setActiveTab('PROFILE')}
            >
              <Text style={styles.tabIcon}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
      flex: 1,
      backgroundColor: '#6C81B8',
      // Thêm khoảng đệm StatusBar cho Android
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 10,
    },
  mainContainer: {
    flex: 1,
    backgroundColor: '#6C81B8',
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6C81B8',
  },
  placeholderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 18,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  greetingText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  userNameText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  mascotContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listSection: {
    marginTop: 15,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  eventCount: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  seeAllText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardMain: {
    flex: 1,
    paddingRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  arrowIcon: {
    fontSize: 22,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#FFF',
    fontSize: 14,
  },

  // Bottom Navigation Bar
  bottomBarWrapper: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pillBottomBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 35,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    width: '85%',
    justifyContent: 'space-between',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabPill: {
    backgroundColor: '#4E6CB5',
  },
  tabIcon: {
    fontSize: 18,
  },
});