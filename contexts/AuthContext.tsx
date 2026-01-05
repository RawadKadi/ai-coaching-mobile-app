import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile, Coach, Client } from '@/types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  coach: Coach | null;
  client: Client | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: 'client' | 'coach') => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      setProfile(profileData);

      if (profileData?.role === 'coach') {
        const { data: coachData } = await supabase
          .from('coaches')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        setCoach(coachData);
        setClient(null);
      } else if (profileData?.role === 'client') {
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (clientError) {
          console.error('Error fetching client profile:', clientError);
        }

        // If client profile doesn't exist yet (should be created by trigger/signup), handle gracefully
        if (!clientData) {
           console.log('Client profile missing for user:', userId);
           // Optional: Try to create it if missing?
           // For now, just leave as null or handle in UI
        }

        setClient(clientData);
        setCoach(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        (async () => {
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            await fetchProfile(session.user.id);
          } else {
            setProfile(null);
            setCoach(null);
            setClient(null);
          }
        })();
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      throw new Error('Please enter a valid email address');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: 'client' | 'coach'
  ) => {
    console.log('[SignUp] Starting signup process for:', email, 'Role:', role);
    
    // Validate email format before sending to Supabase
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      console.error('[SignUp] Invalid email format:', email);
      throw new Error('Please enter a valid email address');
    }

    // Trim and lowercase the email
    const cleanEmail = email.trim().toLowerCase();
    
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    if (error) {
      console.error('[SignUp] Auth signup error:', error);
      throw error;
    }
    if (!data.user) {
      console.error('[SignUp] No user returned from signup');
      throw new Error('No user returned');
    }
    
    console.log('[SignUp] Auth user created:', data.user.id);

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      role,
      onboarding_completed: false,
    });

    if (profileError) {
      console.error('[SignUp] Profile insert error:', profileError);
      throw profileError;
    }
    
    console.log('[SignUp] Profile created successfully');

    if (role === 'coach') {
      console.log('[SignUp] Creating coach record...');
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .insert({
          user_id: data.user.id,
          is_active: true,
        })
        .select()
        .single();

      if (coachError) {
        console.error('[SignUp] Coach insert error:', coachError);
        throw coachError;
      }
      
      console.log('[SignUp] Coach created:', coachData.id);

      await supabase.from('ai_coach_brains').insert({
        coach_id: coachData.id,
        tone: 'professional and motivating',
        style: 'supportive and educational',
      });
      
      console.log('[SignUp] AI brain created');
    } else {
      console.log('[SignUp] Creating client record for user:', data.user.id);
      const { error: clientError } = await supabase.from('clients').insert({
        user_id: data.user.id,
      });

      if (clientError) {
        console.error('[SignUp] ❌ CLIENT INSERT FAILED:', clientError);
        console.error('[SignUp] Error details:', JSON.stringify(clientError, null, 2));
        throw clientError;
      }
      
      console.log('[SignUp] ✅ Client record created successfully');
    }
    
    console.log('[SignUp] Signup process completed successfully');
    
    // Small delay to ensure all database triggers complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('[SignUp] Ready for navigation');
    return true;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // Clear all state
    setSession(null);
    setUser(null);
    setProfile(null);
    setCoach(null);
    setClient(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        coach,
        client,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
