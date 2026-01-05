import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Upload, Save, Eye } from 'lucide-react-native';
import { useBrand } from '@/contexts/BrandContext';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export default function BrandSettingsScreen() {
  const router = useRouter();
  const { brand, canManageBrand, updateBrandSettings, refreshBrand } = useBrand();
  const { coach } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#10B981');
  const [showPreview, setShowPreview] = useState(false);

  // Load brand data
  useEffect(() => {
    if (brand) {
      setBrandName(brand.name);
      setLogoUrl(brand.logo_url || '');
      setPrimaryColor(brand.primary_color);
      setSecondaryColor(brand.secondary_color);
    }
  }, [brand]);

  // Check permissions
  if (!canManageBrand) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Brand Settings</Text>
        </View>
        
        <View style={styles.noPermissionContainer}>
          <Text style={styles.noPermissionTitle}>No Permission</Text>
          <Text style={styles.noPermissionText}>
            Brand settings are managed by your parent coach.
          </Text>
          
          {brand && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Current Brand:</Text>
              {brand.logo_url && (
                <Image source={{ uri: brand.logo_url }} style={styles.logoPreview} />
              )}
              <Text style={styles.brandNamePreview}>{brand.name}</Text>
              <View style={styles.colorRow}>
                <View style={styles.colorBox}>
                  <View style={[styles.colorSwatch, { backgroundColor: brand.primary_color }]} />
                  <Text style={styles.colorLabel}>Primary</Text>
                </View>
                <View style={styles.colorBox}>
                  <View style={[styles.colorSwatch, { backgroundColor: brand.secondary_color }]} />
                  <Text style={styles.colorLabel}>Secondary</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photos to upload a logo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadLogo(result.assets[0].uri);
    }
  };

  const uploadLogo = async (uri: string) => {
    try {
      setUploading(true);
      
      const fileExt = uri.split('.').pop();
      const fileName = `brand-logo-${Date.now()}.${fileExt}`;
      const filePath = `brands/${fileName}`;

      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('public-files')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public-files')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);
      Alert.alert('Success', 'Logo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading logo:', error);
      Alert.alert('Error', 'Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!brandName.trim()) {
      Alert.alert('Error', 'Please enter a brand name');
      return;
    }

    setLoading(true);
    
    try {
      const success = await updateBrandSettings({
        name: brandName,
        logo_url: logoUrl || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });

      if (success) {
        Alert.alert('Success', 'Brand settings updated successfully!');
        router.back();
      } else {
        Alert.alert('Error', 'Failed to update brand settings');
      }
    } catch (error) {
      console.error('Error saving brand:', error);
      Alert.alert('Error', 'An error occurred while saving');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Brand Settings</Text>
        <TouchableOpacity onPress={() => setShowPreview(!showPreview)} style={styles.previewButton}>
          <Eye size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Brand Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Brand Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Elite Fitness Gym"
            value={brandName}
            onChangeText={setBrandName}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Logo Upload */}
        <View style={styles.section}>
          <Text style={styles.label}>Brand Logo</Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={pickImage}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#3B82F6" />
            ) : (
              <>
                <Upload size={20} color="#3B82F6" />
                <Text style={styles.uploadButtonText}>
                  {logoUrl ? 'Change Logo' : 'Upload Logo'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          {logoUrl && (
            <View style={styles.logoPreviewContainer}>
              <Image source={{ uri: logoUrl }} style={styles.logoPreview} />
            </View>
          )}
        </View>

        {/* Primary Color */}
        <View style={styles.section}>
          <Text style={styles.label}>Primary Color</Text>
          <Text style={styles.helperText}>Used for buttons, headers, and accents</Text>
          <View style={styles.colorInputContainer}>
            <View style={[styles.colorPreview, { backgroundColor: primaryColor }]} />
            <TextInput
              style={styles.colorInput}
              placeholder="#3B82F6"
              value={primaryColor}
              onChangeText={setPrimaryColor}
              placeholderTextColor="#9CA3AF"
              maxLength={7}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Secondary Color */}
        <View style={styles.section}>
          <Text style={styles.label}>Secondary Color</Text>
          <Text style={styles.helperText}>Used for secondary elements and accents</Text>
          <View style={styles.colorInputContainer}>
            <View style={[styles.colorPreview, { backgroundColor: secondaryColor }]} />
            <TextInput
              style={styles.colorInput}
              placeholder="#10B981"
              value={secondaryColor}
              onChangeText={setSecondaryColor}
              placeholderTextColor="#9CA3AF"
              maxLength={7}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Preview Section */}
        {showPreview && (
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Preview</Text>
            
            <View style={styles.previewCard}>
              {logoUrl && (
                <Image source={{ uri: logoUrl }} style={styles.previewLogo} />
              )}
              <Text style={styles.previewBrandName}>{brandName || 'Your Brand'}</Text>
              
              <View style={styles.previewButtons}>
                <View style={[styles.previewButton, { backgroundColor: primaryColor }]}>
                  <Text style={styles.previewButtonText}>Primary Button</Text>
                </View>
                <View style={[styles.previewButton, { backgroundColor: secondaryColor }]}>
                  <Text style={styles.previewButtonText}>Secondary Button</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Save size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  previewButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 12,
    borderStyle: 'dashed',
    padding: 20,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  logoPreviewContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  logoPreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  colorInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  colorInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  previewSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewLogo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginBottom: 12,
  },
  previewBrandName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  previewButtons: {
    width: '100%',
    gap: 12,
  },
  previewButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  previewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noPermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noPermissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  noPermissionText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  previewContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
  },
  previewLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  brandNamePreview: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
    marginBottom: 16,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 24,
  },
  colorBox: {
    alignItems: 'center',
  },
  colorSwatch: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  colorLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
});
