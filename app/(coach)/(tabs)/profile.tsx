import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, useTheme } from '@/contexts/BrandContext';
import { LogOut, User, Settings, Camera, Trash2, Image as ImageIcon, Users, UserPlus } from 'lucide-react-native';
import { BrandedAvatar } from '@/components/BrandedAvatar';
import { BrandedText } from '@/components/BrandedText';
import { BrandedCard } from '@/components/BrandedCard';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

export default function CoachProfileScreen() {
  const router = useRouter();
  const { profile, signOut, coach, refreshProfile } = useAuth();
  const { brand, canManageBrand } = useBrand();
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };
  
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera to take a profile picture.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const deletePhoto = async () => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setUploading(true);
              const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', profile?.id);

              if (error) throw error;
              
              await refreshProfile();
              Alert.alert('Success', 'Profile photo removed.');
            } catch (error) {
              console.error('Error deleting avatar:', error);
              Alert.alert('Error', 'Failed to remove profile photo.');
            } finally {
              setUploading(false);
            }
          }
        }
      ]
    );
  };

  const uploadAvatar = async (uri: string) => {
    try {
      setUploading(true);
      
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `avatar-${profile?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Fetch the image and convert to arrayBuffer
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      await refreshProfile();
      Alert.alert('Success', 'Profile photo updated!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload profile photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleEditPhoto = () => {
    Alert.alert(
      'Profile Photo',
      'Update your profile photo',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickImage },
        profile?.avatar_url ? { text: 'Delete Photo', onPress: deletePhoto, style: 'destructive' } : null,
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean) as any
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <BrandedText variant="xxl" weight="heading">Profile</BrandedText>
      </View>

      <View style={styles.content}>
        <BrandedCard variant="elevated" style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <BrandedAvatar 
              name={profile?.full_name || 'User'} 
              size={120}
              imageUrl={profile?.avatar_url}
              useBrandColor={true}
            />
            <TouchableOpacity 
              style={[styles.editBadge, { backgroundColor: theme.colors.primary }]}
              onPress={handleEditPhoto}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Camera size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
          <BrandedText variant="xl" weight="heading" style={styles.name}>
            {profile?.full_name}
          </BrandedText>
          <BrandedText variant="sm" color="secondary">
            Coach Account
          </BrandedText>
        </BrandedCard>

        <BrandedCard variant="elevated" style={styles.menuSection}>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} onPress={() => router.push('/(coach)/settings')}>
            <Settings size={20} color={theme.colors.textSecondary} />
            <BrandedText variant="base" style={styles.menuItemText}>Settings</BrandedText>
          </TouchableOpacity>

          {/* Team Management - Only for parent coaches */}
          {coach?.is_parent_coach && (
            <TouchableOpacity 
              style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
              onPress={() => router.push('/(coach)/team')}
            >
              <Users size={20} color={theme.colors.secondary} />
              <BrandedText variant="base" style={styles.menuItemText}>
                Team Management
                <BrandedText variant="sm" weight="700" style={styles.parentBadge}> • Parent</BrandedText>
              </BrandedText>
            </TouchableOpacity>
          )}

          {/* Invite Client - For all coaches */}
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} 
            onPress={() => router.push('/(coach)/invite-client')}
          >
            <UserPlus size={20} color={theme.colors.accent} />
            <BrandedText variant="base" style={styles.menuItemText}>Invite Client</BrandedText>
          </TouchableOpacity>

          {/* TEST: Deep Link Tester (Remove after testing) */}
          {/* <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: '#FFF7ED' }]} 
            onPress={() => router.push('/(coach)/test-deeplink')}
          >
            <Link size={20} color="#F97316" />
            <Text style={[styles.menuItemText, { color: '#F97316' }]}>
              🧪 Test Deep Links
            </Text>
          </TouchableOpacity> */}

          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} onPress={handleSignOut}>
            <LogOut size={20} color={theme.colors.error} />
            <BrandedText variant="base" color="error" style={styles.menuItemText}>
              Sign Out
            </BrandedText>
          </TouchableOpacity>
        </BrandedCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  profileCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
  },
  editBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  menuSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
  },
  badgeText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  parentBadge: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  aiBrainText: {
    color: '#8B5CF6',
  },
  signOutText: {
    color: '#EF4444',
  },
});
