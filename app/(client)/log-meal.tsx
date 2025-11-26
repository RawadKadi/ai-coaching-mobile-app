import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';

export default function LogMealScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Log Meal</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={24} color="#000" />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholder}>Camera View Will Go Here</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#FFF',
    fontSize: 18,
  },
});
