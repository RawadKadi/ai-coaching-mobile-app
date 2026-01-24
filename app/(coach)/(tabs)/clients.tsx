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
import { useTheme } from '@/contexts/BrandContext';
import { supabase } from '@/lib/supabase';
import { Search, ChevronRight, Users } from 'lucide-react-native';
import { BrandedText } from '@/components/BrandedText';
import { BrandedCard } from '@/components/BrandedCard';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { BrandedInput } from '@/components/BrandedInput';

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
  const theme = useTheme();
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
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View 
        style={[
          styles.header, 
          { 
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
            paddingHorizontal: 24 * theme.spacing.scale,
            paddingTop: 60 * theme.spacing.scale,
            paddingBottom: 24 * theme.spacing.scale,
          }
        ]}
      >
        <BrandedText variant="xxl" weight="heading">Clients</BrandedText>
        <BrandedText variant="sm" color="secondary" style={styles.subtitle}>
          {clients.length} total
        </BrandedText>
      </View>

      {clients.length > 0 && (
        <View style={[styles.searchContainer, { margin: 16 * theme.spacing.scale }]}>
          <Search size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <BrandedInput
            style={styles.searchInput}
            placeholder="Search clients..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      <ScrollView style={[styles.content, { paddingHorizontal: 16 * theme.spacing.scale }]}>
        {filteredClients.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={48} color={theme.colors.border} />
            <BrandedText variant="lg" weight="heading" style={styles.emptyTitle}>
              {searchQuery ? 'No results found' : 'No clients yet'}
            </BrandedText>
            <BrandedText variant="sm" color="secondary" style={styles.emptyText}>
              {searchQuery
                ? 'Try adjusting your search'
                : 'Clients will appear here once they\'re linked to your account'}
            </BrandedText>
          </View>
        ) : (
          filteredClients.map((client) => (
            <TouchableOpacity
              key={client.id}
              onPress={() => router.push(`/(coach)/clients/${client.id}`)}
            >
              <BrandedCard variant="elevated" style={styles.clientCard}>
                <View style={styles.clientInfo}>
                  <BrandedAvatar 
                    name={client.profiles?.full_name || 'Client'}
                    size={48}
                    useBrandColor={true}
                  />
                  <View style={styles.clientDetails}>
                    <BrandedText variant="base" weight="heading" style={styles.clientName}>
                      {client.profiles?.full_name || 'Unknown'}
                    </BrandedText>
                    {client.goal && (
                      <BrandedText variant="xs" color="secondary">
                        Goal: {client.goal}
                      </BrandedText>
                    )}
                    {client.experience_level && (
                      <BrandedText variant="xs" color="secondary">
                        {client.experience_level}
                      </BrandedText>
                    )}
                  </View>
                </View>
                <ChevronRight size={20} color={theme.colors.textSecondary} />
              </BrandedCard>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    borderBottomWidth: 1,
  },
  subtitle: {
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 16
  },
  content: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  clientDetails: {
    flex: 1,
  },
  clientName: {
    marginBottom: 4,
  },
});
