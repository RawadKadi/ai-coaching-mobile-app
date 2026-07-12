import { useBrandColors } from '@/contexts/BrandContext';
import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { Home, Users, User, Calendar, MessageSquare } from 'lucide-react-native';
import { useUnread } from '@/contexts/UnreadContext';
import { FuturisticTabBar } from '@/components/FuturisticTabBar';

export default function CoachTabLayout() {
  const colors = useBrandColors();
  const { unreadCount } = useUnread();
  
  return (
      <Tabs
        tabBar={props => <FuturisticTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ size, color }) => <Home size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Schedule',
            tabBarIcon: ({ size, color }) => <Calendar size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: 'Management',
            tabBarIcon: ({ size, color }) => <Users size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ size, color }) => <MessageSquare size={22} color={color} />,
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.primary, color: 'white', fontSize: 10, fontWeight: 'bold' },
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
          }}
        />
        {/* Hidden Screens */}
        <Tabs.Screen name="ai-brain" options={{ href: null }} />
      </Tabs>
  );
}
