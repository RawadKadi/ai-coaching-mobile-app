import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { Home, Users, User, Calendar, MessageSquare, BrainCircuit, Target } from 'lucide-react-native';
import { useUnread } from '@/contexts/UnreadContext';

export default function CoachTabLayout() {
  const { unreadCount } = useUnread();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3B82F6', 
        tabBarInactiveTintColor: '#475569', 
        tabBarStyle: {
          backgroundColor: '#020617',
          borderTopWidth: 1,
          borderTopColor: '#0F172A',
          paddingBottom: Platform.OS === 'ios' ? 32 : 12,
          paddingTop: 12,
          height: Platform.OS === 'ios' ? 96 : 72,
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: 'Outfit_700Bold', 
          fontWeight: 'black',
          marginTop: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: '#020617' }} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hub',
          tabBarIcon: ({ size, color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Phase',
          tabBarIcon: ({ size, color }) => <Calendar size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Units',
          tabBarIcon: ({ size, color }) => <Users size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Comms',
          tabBarIcon: ({ size, color }) => <MessageSquare size={22} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#3B82F6', color: 'white', fontSize: 10, fontWeight: 'bold' },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      {/* Hidden Screens */}
      <Tabs.Screen name="ai-brain" options={{ href: null }} />
      <Tabs.Screen name="challenges" options={{ href: null }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null }} />
      <Tabs.Screen name="chat/coach/[coachId]" options={{ href: null }} />
    </Tabs>
  );
}
