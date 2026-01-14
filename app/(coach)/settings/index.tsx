import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { ArrowLeft, Clock, ChevronRight, Palette, Brain } from 'lucide-react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { coach } = useAuth();
  const { canManageBrand } = useBrand();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>General</Text>
        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/(coach)/settings/availability')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
                <Clock size={20} color="#3B82F6" />
              </View>
              <Text style={styles.menuItemText}>Availability</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Brand Settings - Only show if coach has brand_id or can manage brand */}
          {(coach?.brand_id || coach?.can_manage_brand) && (
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/(coach)/settings/branding')}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: '#FFF7ED' }]}>
                  <Palette size={20} color="#F59E0B" />
                </View>
                <View>
                  <Text style={styles.menuItemText}>Brand Settings</Text>
                  {canManageBrand && (
                    <Text style={styles.badgeText}>Manage brand colors & logo</Text>
                  )}
                </View>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          {/* AI Brain */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/(coach)/(tabs)/ai-brain')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#F5F3FF' }]}>
                <Brain size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.menuItemText}>AI Brain</Text>
            </View>
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
          
          {/* Future settings can be added here */}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 16,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  badgeText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
