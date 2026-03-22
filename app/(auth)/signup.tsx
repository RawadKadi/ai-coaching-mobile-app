import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { validateInviteCode } from '@/lib/brand-service';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const params = useLocalSearchParams();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'client' | 'coach'>('client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [validatingInvite, setValidatingInvite] = useState(false);
  const [inviteValid, setInviteValid] = useState(false);

  // Handle deep link invite code (Client or Sub-Coach)
  useEffect(() => {
    const invite = params.invite as string;
    if (invite) {
      console.log('[Signup] Invite code detected:', invite);
      setInviteCode(invite);
      
      // Determine if it's a sub-coach invite (usually a UUID/long token) 
      // or a client invite (usually shorter 10-char code)
      if (invite.length > 20) {
        console.log('[Signup] Treating as sub-coach invite');
        setRole('coach');
        validateSubCoachInvite(invite);
      } else {
        console.log('[Signup] Treating as client invite');
        setRole('client');
        validateInvite(invite);
      }
    }
  }, [params.invite]);

  const validateSubCoachInvite = async (token: string) => {
    setValidatingInvite(true);
    try {
      const { data, error } = await supabase.rpc('validate_subcoach_invite', {
        p_invite_token: token
      });

      if (error || !data?.valid) {
        setInviteValid(false);
        Alert.alert('Invalid Invite', data?.message || 'This sub-coach invitation is invalid or has expired.');
      } else {
        setInviteValid(true);
        Alert.alert(
          'Join Team! 🤝',
          `You've been invited by ${data.parent_coach_name} to join their coaching team!`,
          [{ text: 'Great!' }]
        );
      }
    } catch (err) {
      console.error('[Signup] Sub-coach validation error:', err);
    } finally {
      setValidatingInvite(false);
    }
  };

  const validateInvite = async (code: string) => {
    if (!code) return;
    
    setValidatingInvite(true);
    try {
      const result = await validateInviteCode(code);
      
      if (result.valid) {
        setInviteValid(true);
        Alert.alert(
          'Valid Invite!',
          'This invite code is valid. Complete the signup to join!',
          [{ text: 'OK' }]
        );
      } else {
        setInviteValid(false);
        Alert.alert(
          'Invalid Invite',
          result.reason === 'expired' ? 'This invite has expired' :
          result.reason === 'max_uses' ? 'This invite has reached max uses' :
          'This invite code is not valid',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
            { text: 'Continue Anyway', onPress: () => setInviteCode('') }
          ]
        );
      }
    } catch (error) {
      console.error('[Signup] Invite validation error:', error);
    } finally {
      setValidatingInvite(false);
    }
  };

  const handleSignUp = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const tokenToPass = inviteCode || undefined;
      console.log('[SignUpScreen] Calling signUp with token:', tokenToPass, '(original inviteCode:', inviteCode, ')');
      const success = await signUp(email, password, fullName, role, tokenToPass);
      console.log('[SignUpScreen] SignUp completed:', success);
      
      if (!success) {
        throw new Error('Signup failed. Please try again.');
      }

      // If signup was successful
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Verification required
        setLoading(false);
        Alert.alert(
          'Success!',
          'Your account has been created. Please check your email to verify your account before signing in.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
        return;
      }

      // If we have a session, navigate to dashboard
      // The TeamInvitationMonitor will handle detecting the auto-linked invite
      // and showing the welcome slider!
      console.log('[SignUpScreen] Navigating to dashboard (/)');
      router.replace('/');
    } catch (err: any) {
      console.error('[SignUpScreen] Signup error:', err);
      setError(err.message || 'Failed to sign up');
      setLoading(false);
    }
  };

  const processCoachInvite = async (token: string, coachId: string) => {
    console.log('[SignUpScreen] Accepting sub-coach invite:', { token, coachId });
    
    const { data: acceptData, error: acceptError } = await supabase.rpc('accept_subcoach_invite', {
      p_invite_token: token,
      p_child_coach_id: coachId
    });

    if (acceptError) {
      console.error('[SignUpScreen] Accept invite error:', acceptError);
      // Even if linking fails, let them to dashboard
      router.replace('/');
    } else {
      console.log('[SignUpScreen] Sub-coach invite accepted successfully:', acceptData);
      
      // Redirect to welcome screen specifically
      router.replace({
        pathname: '/(coach)/team-welcome',
        params: { 
          parentCoachName: acceptData.parent_coach_name || 'your lead coach',
          hierarchyId: acceptData.hierarchy_id
        }
      });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the coaching community</Text>

          {/* Invite Code Banner */}
          {inviteCode && (
            <View style={[styles.inviteBanner, inviteValid ? styles.inviteBannerValid : styles.inviteBannerInvalid]}>
              <Text style={styles.inviteLabel}>
                {validatingInvite ? '  Validating...' :
                 inviteValid ? '✓ Valid Invite Code' :
                 '✗ Invalid Invite Code'}
              </Text>
              <Text style={styles.inviteCode}>{inviteCode}</Text>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.form}>
            {/* Hide role selector if coming from invite */}
            {!inviteCode && (
              <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'client' && styles.roleButtonActive,
                ]}
                onPress={() => setRole('client')}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === 'client' && styles.roleButtonTextActive,
                  ]}
                >
                  I'm a Client
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleButton,
                  role === 'coach' && styles.roleButtonActive,
                ]}
                onPress={() => setRole('coach')}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    role === 'coach' && styles.roleButtonTextActive,
                  ]}
                >
                  I'm a Coach
                </Text>
              </TouchableOpacity>
            </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholderTextColor="#9CA3AF"
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#9CA3AF"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />

            {/* Invite Code Input - Only for clients without deep link */}
            {role === 'client' && !inviteCode && (
              <View>
                <Text style={styles.optionalLabel}>Have an invite code? (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter invite code"
                  value={inviteCode}
                  onChangeText={(text) => {
                    setInviteCode(text);
                    if (text.length >= 10) {
                      validateInvite(text);
                    }
                  }}
                  autoCapitalize="none"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.back()}
            >
              <Text style={styles.linkText}>
                Already have an account? Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
  },
  error: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  form: {
    gap: 16,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  roleButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  roleButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#3B82F6',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    padding: 8,
  },
  linkText: {
    color: '#3B82F6',
    fontSize: 14,
  },
  optionalLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    marginTop: 4,
  },
  inviteBanner: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 12,
    borderWidth: 2,
  },
  inviteBannerValid: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  inviteBannerInvalid: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  inviteLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  inviteCode: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});
