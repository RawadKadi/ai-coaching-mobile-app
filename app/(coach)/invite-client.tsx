import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  SafeAreaView,
  TextInput,
  Clipboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Link, QrCode, Copy, MessageCircle, Mail, Calendar, Users } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand, useBrandColors } from '@/contexts/BrandContext';
import { generateInviteCode } from '@/lib/brand-service';
import { BrandedHeader } from '@/components/BrandedHeader';
import { BrandedButton } from '@/components/BrandedButton';

export default function InviteClientScreen() {
  const router = useRouter();
  const { coach } = useAuth();
  const { brand } = useBrand();
  const { primary, secondary } = useBrandColors();
  
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [unlimited, setUnlimited] = useState(false);

  const handleGenerate = async () => {
    if (!coach?.id) {
      Alert.alert('Error', 'Coach information not found');
      return;
    }

    setLoading(true);

    try {
      const uses = unlimited ? 999 : parseInt(maxUses) || 1;
      const days = parseInt(expiresInDays) || 7;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + days);

      const result = await generateInviteCode(
        coach.id,
        uses,
        expirationDate.toISOString()
      );

      if (result.success && result.code) {
        setInviteCode(result.code);
        Alert.alert('Success!', 'Invite code generated successfully');
      } else {
        Alert.alert('Error', result.error || 'Failed to generate invite code');
      }
    } catch (error: any) {
      console.error('[InviteClient] Generate error:', error);
      Alert.alert('Error', error.message || 'Failed to generate invite');
    } finally {
      setLoading(false);
    }
  };

  const getInviteLink = () => {
    // Use your app's custom scheme or https link
    return `https://coaching.app/join/${inviteCode}`;
  };

  const handleCopyLink = async () => {
    Clipboard.setString(getInviteLink());
    Alert.alert('Copied!', 'Invite link copied to clipboard');
  };

  const handleShareWhatsApp = async () => {
    const message = `Join ${brand?.name || 'my coaching program'}! 💪\n\nClick here to get started:\n${getInviteLink()}`;
    
    try {
      await Share.share({
        message,
        title: 'Coaching Invite',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleShareEmail = async () => {
    const subject = `Join ${brand?.name || 'My Coaching Program'}`;
    const body = `You're invited to join ${brand?.name || 'my coaching program'}!\n\nClick the link below to get started:\n${getInviteLink()}\n\nLooking forward to working with you!`;
    
    try {
      await Share.share({
        message: body,
        title: subject,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleShareSMS = async () => {
    const message = `Join ${brand?.name || 'my coaching'}! ${getInviteLink()}`;
    
    try {
      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <BrandedHeader
        title="Invite Client"
        showBackButton
        onBackPress={() => router.back()}
      />

      <ScrollView style={styles.content}>
        {/* Invite Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite Settings</Text>
          
          {/* Max Uses */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Maximum Uses</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, unlimited && styles.inputDisabled]}
                value={maxUses}
                onChangeText={setMaxUses}
                keyboardType="number-pad"
                editable={!unlimited}
                placeholder="1"
              />
              <TouchableOpacity
                style={[styles.checkbox, unlimited && styles.checkboxActive]}
                onPress={() => setUnlimited(!unlimited)}
              >
                <Text style={[styles.checkboxText, unlimited && styles.checkboxTextActive]}>
                  Unlimited
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Expiration */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Expires In (Days)</Text>
            <TextInput
              style={styles.input}
              value={expiresInDays}
              onChangeText={setExpiresInDays}
              keyboardType="number-pad"
              placeholder="7"
            />
          </View>

          {/* Generate Button */}
          <BrandedButton
            title="Generate Invite Code"
            variant="primary"
            onPress={handleGenerate}
            loading={loading}
            disabled={loading}
            icon={<QrCode size={20} color="#FFFFFF" />}
            style={styles.generateButton}
          />
        </View>

        {/* Generated Invite */}
        {inviteCode && (
          <View style={[styles.inviteCard, { borderColor: primary }]}>
            <View style={styles.inviteHeader}>
              <Link size={24} color={primary} />
              <Text style={styles.inviteTitle}>Your Invite Link</Text>
            </View>

            {/* Invite Code */}
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Code:</Text>
              <Text style={styles.codeText}>{inviteCode}</Text>
            </View>

            {/* Full Link */}
            <View style={styles.linkBox}>
              <Text style={styles.linkText} numberOfLines={1}>
                {getInviteLink()}
              </Text>
            </View>

            {/* Copy Button */}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: `${primary}15` }]}
              onPress={handleCopyLink}
            >
              <Copy size={18} color={primary} />
              <Text style={[styles.actionButtonText, { color: primary }]}>
                Copy Link
              </Text>
            </TouchableOpacity>

            {/* Share Options */}
            <Text style={styles.shareTitle}>Share via:</Text>
            <View style={styles.shareButtons}>
              <TouchableOpacity
                style={[styles.shareButton, { backgroundColor: '#25D366' }]}
                onPress={handleShareWhatsApp}
              >
                <MessageCircle size={20} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareButton, { backgroundColor: '#EA4335' }]}
                onPress={handleShareEmail}
              >
                <Mail size={20} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareButton, { backgroundColor: secondary }]}
                onPress={handleShareSMS}
              >
                <MessageCircle size={20} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>SMS</Text>
              </TouchableOpacity>
            </View>

            {/* Info */}
            <View style={styles.infoBox}>
              <Calendar size={16} color="#6B7280" />
              <Text style={styles.infoText}>
                {unlimited ? 'Unlimited' : maxUses} use(s) • Expires in {expiresInDays} days
              </Text>
            </View>
          </View>
        )}

        {/* How It Works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How It Works:</Text>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: primary }]}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={styles.stepText}>
              Generate an invite code with your preferred settings
            </Text>
          </View>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: primary }]}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={styles.stepText}>
              Share the link via WhatsApp, email, or SMS
            </Text>
          </View>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: primary }]}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={styles.stepText}>
              Client clicks link, creates account, and joins your program
            </Text>
          </View>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: primary }]}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <Text style={styles.stepText}>
              They're automatically added to your client list!
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  checkbox: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  checkboxText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  checkboxTextActive: {
    color: '#3B82F6',
  },
  generateButton: {
    marginTop: 8,
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  inviteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'monospace',
  },
  linkBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  linkText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  shareButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
  },
  howItWorks: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
  },
  howTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    paddingTop: 4,
  },
});
