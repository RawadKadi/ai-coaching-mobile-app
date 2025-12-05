import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Search, ChevronRight, Users } from 'lucide-react-native';

interface ClientWithProfile {
  id: string;
  goal?: string;
  experience_level?: string;
  profiles: {
    full_name: string;
  };
}

export default function ClientsScreen() {
  const router = useRouter();
  const { coach } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (coach) {
      loadClients();

      // Set up real-time subscription for new client linkings
      const subscription = supabase
        .channel('coach_client_links_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'coach_client_links',
            filter: `coach_id=eq.${coach.id}`,
          },
          (payload) => {
            console.log('[Real-time] New client linked!', payload);
            // Reload clients when a new link is created
            loadClients();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    } else {
      setLoading(false);
    }
  }, [coach]);

  const loadClients = async () => {
    if (!coach) return;

    try {
      setLoading(true);
      
      // Use the secure RPC function to get clients
      const { data, error } = await supabase.rpc('get_my_clients');

      if (error) throw error;

      console.log('Clients data:', data);

      // Map the RPC result to the expected format
      const clientList = data?.map((item: any) => ({
        id: item.client_id,
        goal: item.client_goal,
        experience_level: item.client_experience,
        profiles: {
          full_name: item.client_name
        }
      })) || [];

      setClients(clientList);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter((client) =>
    client.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Clients</Text>
        <Text style={styles.subtitle}>{clients.length} total</Text>
      </View>

      {clients.length > 0 && (
        <View style={styles.searchContainer}>
          <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      )}

      <ScrollView style={styles.content}>
        {filteredClients.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No results found' : 'No clients yet'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Try adjusting your search'
                : 'Clients will appear here once they\'re linked to your account'}
            </Text>
          </View>
        ) : (
          filteredClients.map((client) => (
            <TouchableOpacity
              key={client.id}
              style={styles.clientCard}
              onPress={() => router.push(`/(coach)/clients/${client.id}`)}
            >
              <View style={styles.clientInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {client.profiles?.full_name?.charAt(0).toUpperCase() || 'C'}
                  </Text>
                </View>
                <View style={styles.clientDetails}>
                  <Text style={styles.clientName}>
                    {client.profiles?.full_name || 'Unknown'}
                  </Text>
                  {client.goal && (
                    <Text style={styles.clientMeta}>Goal: {client.goal}</Text>
                  )}
                  {client.experience_level && (
                    <Text style={styles.clientMeta}>{client.experience_level}</Text>
                  )}
                </View>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  clientMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
});
