import { Tabs, useRouter } from 'expo-router';
import { Home, Activity, MessageCircle, User, Camera } from 'lucide-react-native';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

export default function ClientTabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
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
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ size, color }) => (
            <Activity size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="log-meal-button" // Dummy route name
        options={{
          title: '',
          tabBarButton: (props) => (
            <TouchableOpacity
              style={styles.cameraButtonContainer}
              onPress={() => router.push('/(client)/log-meal')}
            >
              <View style={styles.cameraButton}>
                <Camera size={28} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ size, color }) => (
            <MessageCircle size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  cameraButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    // Removed top: -20 to prevent clipping
  },
  cameraButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
