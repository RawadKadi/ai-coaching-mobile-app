import { Tabs } from 'expo-router';
import { Home, Users, User, Calendar, MessageSquare } from 'lucide-react-native';
import { useUnread } from '@/contexts/UnreadContext';
import { useTheme } from '@/contexts/BrandContext';

export default function CoachTabLayout() {
  const { unreadCount } = useUnread();
  const theme = useTheme();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          paddingBottom: 24,
          paddingTop: 8,
          height: 80,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ size, color }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ size, color }) => <MessageSquare size={size} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
      {/* Keep ai-brain file but hide from tabs - accessible from Profile */}
      <Tabs.Screen
        name="ai-brain"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      {/* Challenges - hide from tabs, accessible via navigation */}
      <Tabs.Screen
        name="challenges"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      {/* Client Chat - hide from tabs, keeps navbar visible */}
      <Tabs.Screen
        name="chat/[id]"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
