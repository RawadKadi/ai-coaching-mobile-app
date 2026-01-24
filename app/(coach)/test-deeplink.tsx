import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Link } from 'lucide-react-native';

export default function TestDeepLinkScreen() {
  const router = useRouter();

  const testInvite = (code: string) => {
    Alert.alert(
      'Testing Deep Link',
      `This simulates clicking: coachingapp://signup?invite=${code}`,
      [
        {
          text: 'Open Signup',
          onPress: () => router.push(`/(auth)/signup?invite=${code}`)
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 Deep Link Tester</Text>
      <Text style={styles.subtitle}>
        Simulates deep links (since Expo Go doesn't support custom schemes)
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => testInvite('f0n2wqnebikprppk')}
      >
        <Link size={20} color="#FFFFFF" />
        <Text style={styles.buttonText}>
          Test With: f0n2wqnebikprppk
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => testInvite('zevdshfxkv141ywq')}
      >
        <Link size={20} color="#3B82F6" />
        <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
          Test With: zevdshfxkv141ywq
        </Text>
      </TouchableOpacity>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>ℹ️ Note:</Text>
        <Text style={styles.noteText}>
          Expo Go doesn't support custom URL schemes. To test real deep links, you need to create a development build with:
        </Text>
        <Text style={styles.code}>npx expo run:ios</Text>
        <Text style={styles.noteText}>
          For now, these buttons simulate the deep link behavior!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#3B82F6',
  },
  note: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#1E3A8A',
    lineHeight: 18,
    marginBottom: 8,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#1E3A8A',
    backgroundColor: '#DBEAFE',
    padding: 8,
    borderRadius: 6,
    marginVertical: 8,
  },
});
