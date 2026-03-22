import { Tabs, useRouter } from 'expo-router';
import { Home, Activity, MessageCircle, User, Camera } from 'lucide-react-native';
import { View, TouchableOpacity, Platform } from 'react-native';
import { useUnread } from '@/contexts/UnreadContext';
import { useTheme } from '@/contexts/BrandContext';

export default function ClientTabLayout() {
  const router = useRouter();
  const { unreadCount } = useUnread();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#020617',
          borderTopWidth: 0,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          paddingTop: 12,
          height: Platform.OS === 'ios' ? 88 : 72,
          elevation: 0,
          shadowOpacity: 0
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 4
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hub',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color }) => <Activity size={22} color={color} />,
        }}
      />
      
      <Tabs.Screen
        name="log-meal-button"
        options={{
          title: '',
          tabBarButton: () => (
            <TouchableOpacity
              className="px-4"
              onPress={() => router.push('/(client)/log-meal')}
            >
              <View className="w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg shadow-blue-500/40 -mt-6 border-4 border-slate-950">
                <Camera size={26} color="white" />
              </View>
            </TouchableOpacity>
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: 'Direct',
          tabBarIcon: ({ color }) => <MessageCircle size={22} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#3B82F6', fontSize: 10, fontWeight: '900' }
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Self',
          tabBarIcon: ({ color }) => <User size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
