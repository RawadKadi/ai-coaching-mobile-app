import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { CameraView, Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import {
  Mic, MicOff, Video as VideoIcon, VideoOff,
  Camera as CameraIcon, User as UserIcon,
  ArrowLeft, ChevronRight, Check, X,
} from 'lucide-react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Detect Expo Go ──────────────────────────────────────────────────────────
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ─── Conditionally require Stream SDK to avoid crashes in Expo Go ────────────
let StreamVideoClient: any = null;
let StreamVideo: any = null;
let StreamCall: any = null;
let CallContent: any = null;

if (!isExpoGo) {
  try {
    const StreamSDK = require('@stream-io/video-react-native-sdk');
    StreamVideoClient = StreamSDK.StreamVideoClient;
    StreamVideo = StreamSDK.StreamVideo;
    StreamCall = StreamSDK.StreamCall;
    CallContent = StreamSDK.CallContent;
  } catch (err) {
    console.warn('Stream SDK was not loaded:', err);
  }
}

// ─── Jitsi Helpers (Fallback for Expo Go) ────────────────────────────────────
const jitsiRoomName = (sessionId: string) =>
  `coachingsession${sessionId.replace(/-/g, '').toLowerCase()}`;

const buildJitsiUrl = (
  room: string,
  displayName: string,
  startMuted: boolean,
  startVideoOff: boolean,
) => {
  const params = [
    `config.prejoinConfig.enabled=false`,
    `config.prejoinPageEnabled=false`,
    `config.startWithAudioMuted=${startMuted}`,
    `config.startWithVideoMuted=${startVideoOff}`,
    `config.disableDeepLinking=true`,
    `config.enableWelcomePage=false`,
    `config.mobileAppPromo=false`,
    `config.toolbarButtons=["microphone","camera","hangup","tileview","participants-pane"]`,
    `userInfo.displayName=${encodeURIComponent(displayName)}`,
  ].join('&');
  return `https://meet.jit.si/${room}#${params}`;
};

const apiKey = process.env.EXPO_PUBLIC_STREAM_API_KEY || 'mock_api_key';

export default function CallScreen() {
  const { id: sessionId, isCoach, participantName } = useLocalSearchParams<{
    id: string;
    isCoach: string;
    participantName: string;
  }>();
  const { user, profile } = useAuth();
  const router = useRouter();

  const myRole: 'coach' | 'athlete' = isCoach === 'true' ? 'coach' : 'athlete';
  const displaySelfName =
    (participantName as string) || (myRole === 'coach' ? 'Coach' : 'Athlete');

  // ── Stream Video Implementation (For stand-alone/dev client build) ───────────
  const client = useMemo(() => {
    if (isExpoGo || !user || !StreamVideoClient) return null;
    const token = process.env.EXPO_PUBLIC_STREAM_USER_TOKEN || 'dummy_token';
    return StreamVideoClient.getOrCreateInstance({
      apiKey,
      user: {
        id: user.id,
        name: profile?.full_name || user.email || 'User',
      },
      token,
    });
  }, [user, profile]);

  const call = useMemo(() => {
    if (isExpoGo || !client || !sessionId) return null;
    return client.call('default', sessionId);
  }, [client, sessionId]);

  const [isJoiningStream, setIsJoiningStream] = useState(!isExpoGo);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (isExpoGo || !call) return;
    let active = true;
    const joinCall = async () => {
      try {
        await call.join({ create: true });
        if (active) setIsJoiningStream(false);
      } catch (err: any) {
        console.error('Failed to join Stream call:', err);
        if (active) {
          setStreamError(err?.message || 'Failed to join video session');
          setIsJoiningStream(false);
        }
      }
    };
    joinCall();
    return () => {
      active = false;
      call.leave().catch((err: any) => console.error('Failed to leave Stream call:', err));
    };
  }, [call]);

  const handleStreamHangup = async () => {
    if (call) {
      try {
        await call.leave();
      } catch (err) {
        console.error('Error leaving Stream call:', err);
      }
    }
    router.back();
  };

  // ── Jitsi WebView Implementation (Fallback for Expo Go) ──────────────────────
  const [hasJoinedJitsi, setHasJoinedJitsi] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [micPermission, setMicPermission] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [availableCameras, setAvailableCameras] = useState<('front' | 'back')[]>(['front', 'back']);
  const [micActivity, setMicActivity] = useState(0.08);
  const [deviceDrawerType, setDeviceDrawerType] = useState<'camera' | 'audio' | null>(null);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  // Request camera and mic permissions (only needed for Prep screen or custom media access)
  useEffect(() => {
    (async () => {
      const { status: camStatus } = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(camStatus === 'granted');
      const { status: micStatus } = await Audio.requestPermissionsAsync();
      setMicPermission(micStatus === 'granted');
      try {
        const types = await Camera.getAvailableCameraTypesAsync() as ('front' | 'back')[];
        if (types.length > 0) setAvailableCameras(types);
      } catch { /* fallback to both */ }
    })();
  }, []);

  // Mic activity animation
  useEffect(() => {
    const interval = setInterval(() => {
      setMicActivity(isMuted ? 0 : 0.04 + Math.random() * 0.42);
    }, 140);
    return () => clearInterval(interval);
  }, [isMuted]);

  const openDeviceDrawer = (type: 'camera' | 'audio') => {
    setDeviceDrawerType(type);
    Animated.spring(drawerAnim, {
      toValue: 1, useNativeDriver: true, tension: 60, friction: 12,
    }).start();
  };

  const closeDeviceDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: 0, duration: 210, useNativeDriver: true,
    }).start(() => setDeviceDrawerType(null));
  };

  const drawerTranslateY = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  const handleJitsiHangup = () => router.back();

  // ── Render Logic ─────────────────────────────────────────────────────────────

  // Case A: Running in Standalone / Dev Client build -> Render Native Stream Call
  if (!isExpoGo) {
    if (!user || !client || !call) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      );
    }
    if (isJoiningStream) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Joining Video Session...</Text>
        </View>
      );
    }
    if (streamError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{streamError}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <StreamVideo client={client}>
        <StreamCall call={call}>
          <SafeAreaView style={styles.container}>
            <CallContent 
              layout="grid"
              onHangupCallHandler={handleStreamHangup}
            />
          </SafeAreaView>
        </StreamCall>
      </StreamVideo>
    );
  }

  // Case B: Running in Expo Go -> Render WebView Jitsi Fallback
  if (hasJoinedJitsi && sessionId) {
    const room = jitsiRoomName(sessionId as string);
    const jitsiUrl = buildJitsiUrl(room, displaySelfName, isMuted, isVideoOff);

    return (
      <View style={styles.callContainer}>
        <WebView
          source={{ uri: jitsiUrl }}
          style={styles.webview}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="always"
          mediaCapturePermissionGrantType="grant"
          onShouldStartLoadWithRequest={(event) => {
            const url = event.url;
            if (
              url.includes('close.html') ||
              url.includes('close2.html') ||
              url === 'https://meet.jit.si/' ||
              url === 'https://meet.jit.si'
            ) {
              handleJitsiHangup();
              return false;
            }
            return true;
          }}
          onNavigationStateChange={(navState) => {
            const url = navState.url;
            if (
              url.includes('close.html') ||
              url.includes('close2.html') ||
              url === 'https://meet.jit.si/' ||
              url === 'https://meet.jit.si'
            ) {
              handleJitsiHangup();
            }
          }}
          onError={() =>
            Alert.alert(
              'Connection issue',
              'Could not load the video call. Check your internet connection.',
              [{ text: 'Go back', onPress: handleJitsiHangup }],
            )
          }
        />
      </View>
    );
  }

  // Render Prep Screen for Jitsi (Expo Go Fallback)
  return (
    <View style={styles.prepContainer}>
      <SafeAreaView style={styles.prepFlex}>
        {/* Header */}
        <View style={styles.prepHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.prepTitle}>Session Setup</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.prepScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.prepSubtitle}>Joining as {displaySelfName} (Expo Go Fallback)</Text>

          {/* Camera Preview */}
          <View style={styles.prepCameraPreview}>
            {!isVideoOff && cameraPermission ? (
              <CameraView style={StyleSheet.absoluteFill} facing={cameraFacing} />
            ) : (
              <View style={styles.cameraOffOverlay}>
                <View style={styles.cameraOffAvatar}>
                  <UserIcon size={48} color="#64748B" />
                </View>
                <Text style={styles.cameraOffText}>
                  {!cameraPermission ? 'Camera access denied' : 'Camera is off'}
                </Text>
              </View>
            )}

            {!isVideoOff && cameraPermission && (
              <View style={styles.previewBadge}>
                <View style={styles.previewBadgeDot} />
                <Text style={styles.previewBadgeText}>PREVIEW</Text>
              </View>
            )}

            <View style={styles.previewControls}>
              <TouchableOpacity
                style={[styles.previewToggleBtn, isMuted && styles.previewToggleBtnRed]}
                onPress={() => setIsMuted(v => !v)}
              >
                {isMuted ? <MicOff size={20} color="#FFF" /> : <Mic size={20} color="#FFF" />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewToggleBtn, isVideoOff && styles.previewToggleBtnRed]}
                onPress={() => setIsVideoOff(v => !v)}
              >
                {isVideoOff ? <VideoOff size={20} color="#FFF" /> : <VideoIcon size={20} color="#FFF" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Mic Level Meter */}
          <View style={styles.micTestRow}>
            <Text style={styles.deviceLabel}>Mic Level</Text>
            <View style={styles.meterContainer}>
              <View style={[styles.meterFill, { width: `${micActivity * 100}%` }]} />
            </View>
            <Text style={styles.meterText}>{isMuted ? 'Muted' : 'Listening...'}</Text>
          </View>

          {/* Device Selectors */}
          <View style={styles.settingsSection}>
            <Text style={styles.sectionHeader}>Devices</Text>

            <TouchableOpacity style={styles.deviceRow} onPress={() => openDeviceDrawer('camera')}>
              <View style={styles.deviceIconBox}>
                <CameraIcon size={18} color="#94A3B8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceTitle}>Camera</Text>
                <Text style={styles.deviceValue}>
                  {cameraFacing === 'front' ? 'Front Camera' : 'Rear Camera'}
                </Text>
              </View>
              <ChevronRight size={16} color="#475569" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.deviceRow} onPress={() => openDeviceDrawer('audio')}>
              <View style={styles.deviceIconBox}>
                <Mic size={18} color="#94A3B8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceTitle}>Microphone</Text>
                <Text style={styles.deviceValue}>
                  {micPermission ? 'Built-in Microphone' : 'Permission Denied'}
                </Text>
              </View>
              <ChevronRight size={16} color="#475569" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoNote}>
            <Text style={styles.infoNoteText}>
              Your mic and camera settings will carry into the live session. Only the people in this session can join this room.
            </Text>
          </View>

          <TouchableOpacity style={styles.joinBtn} onPress={() => setHasJoinedJitsi(true)}>
            <Text style={styles.joinBtnText}>Join Now</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* Device Drawer Modal */}
      {deviceDrawerType !== null && (
        <Modal transparent animationType="fade" onRequestClose={closeDeviceDrawer}>
          <TouchableOpacity style={styles.drawerOverlay} activeOpacity={1} onPress={closeDeviceDrawer}>
            <Animated.View style={[styles.drawerSheet, { transform: [{ translateY: drawerTranslateY }] }]}>
              <TouchableOpacity activeOpacity={1}>
                <View style={styles.drawerHandle} />
                <View style={styles.drawerHeader}>
                  <Text style={styles.drawerTitle}>
                    {deviceDrawerType === 'camera' ? 'Choose Camera' : 'Choose Microphone'}
                  </Text>
                  <TouchableOpacity onPress={closeDeviceDrawer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                {deviceDrawerType === 'camera' &&
                  availableCameras.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={styles.drawerOption}
                      onPress={() => { setCameraFacing(type); closeDeviceDrawer(); }}
                    >
                      <View style={styles.drawerOptionIcon}>
                        <CameraIcon size={18} color="#94A3B8" />
                      </View>
                      <Text style={styles.drawerOptionText}>
                        {type === 'front' ? 'Front Camera' : 'Rear Camera'}
                      </Text>
                      <View style={{ flex: 1 }} />
                      {cameraFacing === type && <Check size={18} color="#2563EB" />}
                    </TouchableOpacity>
                  ))}

                {deviceDrawerType === 'audio' && (
                  <>
                    <TouchableOpacity style={styles.drawerOption}>
                      <View style={styles.drawerOptionIcon}>
                        <Mic size={18} color="#94A3B8" />
                      </View>
                      <Text style={styles.drawerOptionText}>Built-in Microphone</Text>
                      <View style={{ flex: 1 }} />
                      {micPermission && <Check size={18} color="#2563EB" />}
                    </TouchableOpacity>
                    {!micPermission && (
                      <Text style={styles.drawerNote}>
                        Microphone access is denied. Enable it in iOS Settings → Privacy → Microphone.
                      </Text>
                    )}
                  </>
                )}
                <View style={{ height: 40 }} />
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E14' },
  loadingContainer: { flex: 1, backgroundColor: '#0B0E14', justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#94A3B8', fontSize: 15, fontWeight: '500' },
  errorContainer: { flex: 1, backgroundColor: '#0B0E14', justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  errorText: { color: '#EF4444', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  backButton: { backgroundColor: '#2563EB', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24 },
  backButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  callContainer: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  prepContainer: { flex: 1, backgroundColor: '#0B0E14' },
  prepFlex: { flex: 1 },
  prepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  prepTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  prepScroll: { paddingHorizontal: 20, paddingBottom: 48 },
  prepSubtitle: { color: '#64748B', fontSize: 13, fontWeight: '500', textAlign: 'center', marginBottom: 20 },
  prepCameraPreview: { width: '100%', height: 240, backgroundColor: '#0F172A', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 20, position: 'relative' },
  cameraOffOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  cameraOffAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#334155' },
  cameraOffText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  previewBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, gap: 5 },
  previewBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  previewBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  previewControls: { position: 'absolute', bottom: 14, flexDirection: 'row', alignSelf: 'center', gap: 12 },
  previewToggleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.60)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  previewToggleBtnRed: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  micTestRow: { marginBottom: 24, gap: 8 },
  deviceLabel: { color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  meterContainer: { height: 5, backgroundColor: '#1E293B', borderRadius: 3, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  meterText: { color: '#334155', fontSize: 11, fontWeight: '500' },
  settingsSection: { marginBottom: 24, gap: 8 },
  sectionHeader: { color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 12 },
  deviceIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  deviceTitle: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  deviceValue: { color: '#475569', fontSize: 12, fontWeight: '500', marginTop: 2 },
  infoNote: { backgroundColor: 'rgba(37,99,235,0.07)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(37,99,235,0.15)', paddingVertical: 12, paddingHorizontal: 16, marginBottom: 24 },
  infoNoteText: { color: '#64748B', fontSize: 12, fontWeight: '500', lineHeight: 18 },
  joinBtn: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 28, alignItems: 'center', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  joinBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  drawerSheet: { backgroundColor: '#0F172A', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  drawerHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#334155', alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  drawerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  drawerOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  drawerOptionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  drawerOptionText: { color: '#CBD5E1', fontSize: 15, fontWeight: '500' },
  drawerNote: { color: '#EF4444', fontSize: 12, fontWeight: '500', marginTop: 12, lineHeight: 18 },
});
