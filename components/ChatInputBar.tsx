import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Keyboard, Animated, ScrollView, FlatList,
  Platform, Dimensions, ActivityIndicator, Alert,
  KeyboardAvoidingView, Easing, PanResponder
} from 'react-native';
import { Image } from 'expo-image'; // disk-cached, hardware-accelerated
import Svg, { Circle, Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/contexts/BrandContext';
import { Send, Plus, Camera, X, Search, Film, Image as ImageIcon, FileText, ClipboardPaste, Play } from 'lucide-react-native';
import { uploadChatMedia } from '@/lib/uploadChatMedia';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = 310;
const PANEL_FULL_HEIGHT = SCREEN_HEIGHT * 0.9;
const TENOR_KEY = process.env.EXPO_PUBLIC_TENOR_API_KEY;

interface GifResult { id: string; previewUrl: string; url: string; }

interface Props {
  /** Called when user sends a plain text message */
  onSendText: (text: string, replyId?: string) => Promise<void>;
  /** Called when user sends a media message — receives JSON string content */
  onSendMedia: (jsonContent: string, replyId?: string) => Promise<void>;
  sending?: boolean;
  placeholder?: string;
  replyingTo?: any;
  onCancelReply?: () => void;
}

type Panel = 'emoji' | 'attach' | null;

export function ChatInputBar({ 
  onSendText, onSendMedia, sending, placeholder = 'Message…', 
  replyingTo, onCancelReply 
}: Props) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifLoadingMore, setGifLoadingMore] = useState(false);
  const [gifHasMore, setGifHasMore] = useState(true);
  const [gifOffset, setGifOffset] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string, type: string, fileName?: string, mimeType?: string } | null>(null);
  const [hasClipboardImage, setHasClipboardImage] = useState(false);
  const [deferRender, setDeferRender] = useState(false);

  const panelHeightAnim = useRef(new Animated.Value(0)).current;
  const currentHeight = useRef(0);
  const startHeight = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const replyAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (replyingTo) {
      Animated.timing(replyAnim, {
        toValue: 1,
        duration: 50, // Instant feel
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
    } else {
      Animated.timing(replyAnim, {
        toValue: 0,
        duration: 100, // Quick close
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start();
    }
  }, [replyingTo]);

  React.useEffect(() => {
    const id = panelHeightAnim.addListener(({ value }) => {
      currentHeight.current = value;
    });
    
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      panelHeightAnim.removeListener(id);
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        // Just track where we started from our own listener value
        startHeight.current = currentHeight.current;
      },
      onPanResponderMove: (_, gestureState) => {
        // Direct value calculation (dy is positive when dragging DOWN)
        let newHeight = startHeight.current - gestureState.dy;
        
        // Add elastic resistance at the top
        if (newHeight > PANEL_FULL_HEIGHT) {
           newHeight = PANEL_FULL_HEIGHT + (newHeight - PANEL_FULL_HEIGHT) * 0.25;
        } else if (newHeight < 0) {
           newHeight = 0;
        }
        
        panelHeightAnim.setValue(newHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const start = startHeight.current;
        const dy = gestureState.dy; // positive = dragged down
        const vy = gestureState.vy;

        let target = PANEL_HEIGHT;

        if (start >= PANEL_FULL_HEIGHT - 50) {
          // Started from EXPANDED (Top)
          if (dy > 300 || vy > 1.2) {
             target = 0; // Dragged down a LOT -> Close
          } else if (dy > 50 || vy > 0.3) {
             target = PANEL_HEIGHT; // Dragged down a bit -> Middle
          } else {
             target = PANEL_FULL_HEIGHT; // Stay Expanded
          }
        } else {
          // Started from MIDDLE
          if (dy < -20 || vy < -0.3) {
             target = PANEL_FULL_HEIGHT; // Dragged up even a bit -> Expand
          } else if (dy > 60 || vy > 0.4) {
             target = 0; // Dragged down -> Close
          } else {
             target = PANEL_HEIGHT; // Stay Middle
          }
        }

        if (target === 0) {
          closePanel();
        } else {
          Animated.spring(panelHeightAnim, {
            toValue: target,
            useNativeDriver: false,
            tension: 65,
            friction: 10,
          }).start();
        }
      }
    })
  ).current;

  // ─── Panel open/close ─────────────────────────────────────────────────────

  const openPanel = (panel: Panel) => {
    Keyboard.dismiss();
    setActivePanel(panel);
    Animated.spring(panelHeightAnim, { toValue: PANEL_HEIGHT, useNativeDriver: false, tension: 50, friction: 8 }).start();
    
    // Defer heavy rendering until the slide-up animation and keyboard-dismissal are totally finished
    setTimeout(() => setDeferRender(true), 250);
  };

  const closePanel = useCallback(() => {
    Animated.timing(panelHeightAnim, { toValue: 0, duration: 200, useNativeDriver: false, easing: Easing.out(Easing.ease) }).start(() => {
      setActivePanel(null);
      setDeferRender(false);
    });
  }, [panelHeightAnim]);

  const togglePanel = (panel: Panel) => {
    if (activePanel === panel) closePanel();
    else openPanel(panel);
  };

  const onInputFocus = () => {
    if (activePanel) {
      panelHeightAnim.setValue(0);
      setActivePanel(null);
      setDeferRender(false);
    }
  };

  // ─── Clipboard Listeners ───────────────────────────────────────────────────

  React.useEffect(() => {
    const checkClipboard = async () => {
      try {
        // hasImageAsync might also not be perfectly supported on all web browsers
        const hasImg = await Clipboard.hasImageAsync();
        setHasClipboardImage(hasImg);
      } catch (e) {}
    };
    
    checkClipboard();

    // Clipboard listener is not supported on web and can cause a crash
    let sub: any = null;
    if (Platform.OS !== 'web' && typeof Clipboard.addClipboardListener === 'function') {
      sub = Clipboard.addClipboardListener(checkClipboard);
    }

    return () => {
      if (sub && typeof Clipboard.removeClipboardListener === 'function') {
        Clipboard.removeClipboardListener(sub);
      }
    };
  }, []);

  // ─── Send text & media ─────────────────────────────────────────────────────

  const handleSend = async () => {
    const msg = text.trim();
    if ((!msg && !selectedMedia) || sending) return;

    setText('');
    const mediaToSend = selectedMedia;
    setSelectedMedia(null);

    if (mediaToSend) {
      // Notify parent immediately with local info
      await onSendMedia(JSON.stringify({
        type: mediaToSend.type,
        url: mediaToSend.uri, // Use local URI optimistically
        fileName: mediaToSend.fileName,
        mimeType: mediaToSend.mimeType,
        isOptimistic: true // Flag to indicate this is not yet on server
      }), replyingTo?.id);
    }
    
    if (replyingTo && !mediaToSend) {
        onCancelReply?.();
    }

    if (msg) {
      await onSendText(msg, replyingTo?.id);
    }
  };

  // ─── Media helpers ─────────────────────────────────────────────────────────

  const handleMediaSelect = (uri: string, type: string, fileName?: string, mimeType?: string) => {
    setSelectedMedia({ uri, type, fileName, mimeType });
    closePanel();
  };

  const pickFromLibrary = async () => {
    closePanel();
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        handleMediaSelect(result.assets[0].uri, result.assets[0].type ?? 'image');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not access photo library.');
    }
  };

  const takePhoto = async () => {
    closePanel();
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        handleMediaSelect(result.assets[0].uri, result.assets[0].type ?? 'image');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  const openCamera = async () => {
    await takePhoto();
  };

  const pickDocument = async () => {
    closePanel();
    try {
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        handleMediaSelect(asset.uri, 'document', asset.name, asset.mimeType ?? 'application/octet-stream');
      }
    } catch {
      Alert.alert('Not available', 'Please run: npx expo install expo-document-picker');
    }
  };

  const pasteFromClipboard = async () => {
    closePanel();
    try {
      const result = await Clipboard.getImageAsync({ format: 'png' });
      if (result) {
        handleMediaSelect(result.data, 'image', 'pasted_image.png', 'image/png');
      } else {
        Alert.alert('No Image', 'Could not find an image in the clipboard.');
      }
    } catch {
      Alert.alert('Error', 'Could not paste image. Please ensure it is a valid image format.');
    }
  };

  // ─── GIF ───────────────────────────────────────────────────────────────────

  const searchGifs = useCallback(async (query: string = '', offset: number = 0, isLoadMore: boolean = false) => {
    if (!process.env.EXPO_PUBLIC_GIPHY_API_KEY) { setGifResults([]); return; }
    
    if (isLoadMore) setGifLoadingMore(true);
    else setGifLoading(true);

    try {
      const endpoint = query.trim() 
        ? `https://api.giphy.com/v1/gifs/search?api_key=${process.env.EXPO_PUBLIC_GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&offset=${offset}`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${process.env.EXPO_PUBLIC_GIPHY_API_KEY}&limit=20&offset=${offset}`;

      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.data) {
        const fetchedGifs: GifResult[] = data.data.map((gif: any) => ({
          id: gif.id,
          url: gif.images?.fixed_height?.url || gif.images?.downsized?.url,
          previewUrl: gif.images?.fixed_width_small?.url || gif.images?.fixed_height_small?.url,
        })).filter((g: any) => g.url);
        
        if (isLoadMore) {
          setGifResults(prev => {
            const newIds = new Set(fetchedGifs.map(g => g.id));
            return [...prev, ...fetchedGifs.filter(g => !prev.some(p => p.id === g.id))];
          });
        } else {
          setGifResults(fetchedGifs);
        }
        
        setGifOffset(offset + 20);
        setGifHasMore(data.pagination?.total_count > offset + 20);
      }
    } catch (error) {
      console.error('Error fetching GIFs:', error);
      if (query && !isLoadMore) setGifResults([]); 
    } finally {
      setGifLoading(false);
      setGifLoadingMore(false);
    }
  }, []);

  const loadMoreGifs = () => {
    if (gifLoading || gifLoadingMore || !gifHasMore) return;
    searchGifs(gifQuery, gifOffset, true);
  };

  // Fetch trending globally when GIF panel opened / cleared
  React.useEffect(() => {
    if (activePanel === 'emoji' && !gifQuery.trim()) {
      searchGifs('');
    }
  }, [activePanel, gifQuery, searchGifs]);

  const handleSendGif = async (gif: GifResult) => {
    const payload = {
      type: 'gif',
      url: gif.url,
      previewUrl: gif.previewUrl,
      id: gif.id
    };
    await onSendMedia(JSON.stringify(payload));
    togglePanel(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const isDisabled = !!sending;

  return (
    <View style={{ backgroundColor: 'transparent' }}>
      {/* ── Optional Media Preview ───────────────────────────────────────────── */}
      {selectedMedia && (
        <View style={styles.mediaPreviewContainer}>
          <View style={[styles.mediaPreviewBox, { borderColor: theme.colors.border }]}>
            {selectedMedia.type === 'image' || selectedMedia.type === 'video' ? (
              <View>
                <Image source={{ uri: selectedMedia.uri }} style={styles.mediaPreviewImage} />
                {selectedMedia.type === 'video' && (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }]}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                      <Play size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.mediaPreviewDoc}>
                <FileText size={24} color={theme.colors.primary} />
                <Text style={{ color: theme.colors.text, fontSize: 10, marginTop: 4 }} numberOfLines={1}>{selectedMedia.fileName}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.mediaPreviewRemove} onPress={() => setSelectedMedia(null)}>
              <X size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Reply Preview Bar ──────────────────────────────────────────────── */}
      {replyingTo && (
        <Animated.View 
          style={[
            styles.replyPreviewContainer, 
            { 
              backgroundColor: '#0F172A', // Pure dark for brand consistency
              opacity: replyAnim,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.05)',
              transform: [
                { translateY: replyAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                { scale: replyAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }
              ]
            }
          ]}
        >
          <View style={[styles.replySideBar, { backgroundColor: theme.colors.primary }]} />
          <View style={styles.replyContent}>
            <Text style={[styles.replySender, { color: theme.colors.primary }]}>
              {replyingTo.isOwn ? 'You' : (replyingTo.sender_name || 'Protocol Hub')}
            </Text>
            <Text style={[styles.replySnippet, { color: 'rgba(255,255,255,0.5)' }]} numberOfLines={1}>
              {(() => {
                try {
                  const content = typeof replyingTo.content === 'string' ? JSON.parse(replyingTo.content) : replyingTo.content;
                  if (content.type === 'image') return '🖼 Photo';
                  if (content.type === 'video') return '🎥 Video';
                  if (content.type === 'gif') return '🎞 GIF';
                  if (content.type === 'document') return '📄 ' + (content.fileName || 'Document');
                } catch (e) {}
                return replyingTo.content;
              })()}
            </Text>
          </View>
          {(() => {
            try {
              const content = typeof replyingTo.content === 'string' ? JSON.parse(replyingTo.content) : replyingTo.content;
              if (content.url && (content.type === 'image' || content.type === 'video' || content.type === 'gif')) {
                return (
                  <View style={styles.replyThumbBox}>
                    <Image source={{ uri: content.thumbnailUrl || content.url }} style={styles.replyThumb} />
                  </View>
                );
              }
            } catch (e) {}
            return null;
          })()}
          <TouchableOpacity 
            style={styles.replyCloseBtn} 
            onPress={onCancelReply}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <X size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </Animated.View>
      )}



      {/* ── Input row ──────────────────────────────────────────────────────── */}
      <View style={[
        styles.inputRow,
        { backgroundColor: '#020617' },
        Platform.OS === 'ios' ? { paddingBottom: (activePanel || isKeyboardVisible) ? 0 : 24 } : { paddingBottom: 12 },
      ]}>

        {/* Action Trigger (Plus) */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => togglePanel('attach')}
          activeOpacity={0.7}
          disabled={isDisabled}
        >
          <Plus
            size={24}
            color={activePanel === 'attach' ? '#3B82F6' : '#64748B'}
            strokeWidth={2.5}
          />
        </TouchableOpacity>

        {/* Styled Focus Input */}
        <View style={[
          styles.inputWrapper,
          { backgroundColor: '#0F172A', borderColor: '#1E293B' },
        ]}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                color: '#FFFFFF',
                fontFamily: theme.typography.fontFamily,
              },
            ]}
            placeholder="Message athlete..."
            placeholderTextColor="#475569"
            value={text}
            onChangeText={setText}
            onFocus={onInputFocus}
            multiline
            editable={!isDisabled}
          />

          {/* Core Engine: Sticker/GIF */}
          <TouchableOpacity
            style={styles.stickerBtn}
            onPress={() => togglePanel('emoji')}
            activeOpacity={0.7}
            disabled={isDisabled}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" stroke={activePanel === 'emoji' ? '#3B82F6' : '#64748B'} strokeWidth="2" />
              <Path d="M12 22C15.5 22 18.5 20 20 17H12C10.3 17 9 15.7 9 14V12H4C4 17.5 7.5 22 12 22Z" fill={activePanel === 'emoji' ? '#3B82F6' : '#64748B'} />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Strategic Send Action */}
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: '#3B82F6' },
            ((!text.trim() && !selectedMedia) || isDisabled) && { opacity: 0.5 },
          ]}
          onPress={handleSend}
          disabled={(!text.trim() && !selectedMedia) || isDisabled}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={20} color="#FFFFFF" fill="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Sliding panel ──────────────────────────────────────────────────── */}
      {activePanel && (
        <Animated.View
          style={[
            styles.panel,
            {
              backgroundColor: '#0F172A',
              borderTopColor: 'rgba(255,255,255,0.05)',
              height: panelHeightAnim,
            },
          ]}
        >
          {/* ── Drag Handle ──────────────────────────────────────────────── */}
          <View 
            {...panResponder.panHandlers} 
            style={styles.dragHandleContainer}
          >
            <View style={[styles.dragHandle, { backgroundColor: theme.colors.border }]} />
          </View>

          {/* ── Attach panel ─────────────────────────────────────────────── */}
          {activePanel === 'attach' && (
            <View style={styles.attachList}>
              <Text style={[styles.panelTitle, { color: '#64748B', fontFamily: theme.typography.fontFamily }]}>
                Send file
              </Text>
              
              <TouchableOpacity style={[styles.attachItem, { borderBottomColor: 'rgba(255,255,255,0.03)' }]} onPress={pickFromLibrary}>
                <View style={[styles.attachIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                  <ImageIcon size={22} color="#3B82F6" />
                </View>
                <View>
                  <Text style={[styles.attachLabel, { color: '#FFFFFF', fontFamily: theme.typography.fontFamily }]}>Photo / Video</Text>
                  <Text style={[styles.attachSub, { color: '#64748B', fontFamily: theme.typography.fontFamily }]}>From your library</Text>
                </View>
              </TouchableOpacity>
    
              <TouchableOpacity style={[styles.attachItem, { borderBottomColor: 'rgba(255,255,255,0.03)' }]} onPress={openCamera}>
                <View style={[styles.attachIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                  <Camera size={22} color="#3B82F6" />
                </View>
                <View>
                  <Text style={[styles.attachLabel, { color: '#FFFFFF', fontFamily: theme.typography.fontFamily }]}>Camera</Text>
                  <Text style={[styles.attachSub, { color: '#64748B', fontFamily: theme.typography.fontFamily }]}>Take a photo</Text>
                </View>
              </TouchableOpacity>
    
              <TouchableOpacity style={[styles.attachItem, { borderBottomColor: 'rgba(255,255,255,0.03)' }]} onPress={pickDocument}>
                <View style={[styles.attachIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                  <FileText size={22} color="#3B82F6" />
                </View>
                <View>
                  <Text style={[styles.attachLabel, { color: '#FFFFFF', fontFamily: theme.typography.fontFamily }]}>Document</Text>
                  <Text style={[styles.attachSub, { color: '#64748B', fontFamily: theme.typography.fontFamily }]}>PDF, Word, etc.</Text>
                </View>
              </TouchableOpacity>
    
              {hasClipboardImage && (
                <TouchableOpacity style={[styles.attachItem, { borderBottomWidth: 0 }]} onPress={pasteFromClipboard}>
                  <View style={[styles.attachIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                    <ClipboardPaste size={22} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={[styles.attachLabel, { color: '#FFFFFF', fontFamily: theme.typography.fontFamily }]}>Paste Image</Text>
                    <Text style={[styles.attachSub, { color: '#64748B', fontFamily: theme.typography.fontFamily }]}>From clipboard</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── GIF panel ────────────────────────────────────────── */}
          {activePanel === 'emoji' && (
            <View style={{ flex: 1 }}>
              {/* Search bar */}
              <View style={[styles.searchRow, { backgroundColor: '#020617' }]}>
                <Search size={16} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: '#FFFFFF', fontFamily: theme.typography.fontFamily }]}
                  placeholder="Search GIFs…"
                  placeholderTextColor="#475569"
                  value={gifQuery}
                  onChangeText={(v) => {
                    setGifQuery(v);
                    searchGifs(v, 0, false);
                  }}
                  returnKeyType="search"
                  autoCapitalize="none"
                />
                {gifQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setGifQuery(''); setGifResults([]); }} style={{ padding: 4 }}>
                    <X size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* GIF Results */}              
              <View style={{ flex: 1, alignItems: 'center', justifyContent: gifResults.length === 0 ? 'center' : 'flex-start' }}>
                  {!process.env.EXPO_PUBLIC_GIPHY_API_KEY && (
                    <Text style={[styles.emptyMsg, { color: theme.colors.textSecondary, textAlign: 'center', padding: 16 }]}>
                      Add EXPO_PUBLIC_GIPHY_API_KEY to .env to enable GIF search
                    </Text>
                  )}
                  {gifLoading && process.env.EXPO_PUBLIC_GIPHY_API_KEY && (
                    /* Skeleton Loader Grid */
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%', padding: 4 }}>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <View key={`skel-${i}`} style={[styles.gifCell, { opacity: 0.6 }]}>
                          <View style={[styles.gifThumb, { backgroundColor: theme.colors.border }]} />
                        </View>
                      ))}
                    </View>
                  )}
                  {!gifLoading && gifResults.length === 0 && gifQuery.length > 0 && process.env.EXPO_PUBLIC_GIPHY_API_KEY && (
                    <Text style={[styles.emptyMsg, { color: theme.colors.textSecondary }]}>No GIFs found</Text>
                  )}
                  {!gifLoading && gifResults.length > 0 && (
                    <FlatList
                      data={gifResults}
                      numColumns={2}
                      keyExtractor={item => item.id}
                      renderItem={({ item }) => (
                        <GifImageItem item={item} onPress={() => handleSendGif(item)} />
                      )}
                      contentContainerStyle={{ padding: 4 }}
                      onEndReached={loadMoreGifs}
                      onEndReachedThreshold={0.5}
                      ListFooterComponent={
                        gifLoadingMore ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} style={{ margin: 16 }} />
                        ) : null
                      }
                    />
                  )}
                </View>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

// ── Circular Upload Progress Ring ─────────────────────────────────────────────
const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CircularProgress({ pct }: { pct: number }) {
  const strokeDashoffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={68} height={68}>
        {/* Track */}
        <Circle
          cx="34" cy="34" r={RADIUS}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={5}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx="34" cy="34" r={RADIUS}
          stroke="#FFFFFF"
          strokeWidth={5}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin="34,34"
        />
      </Svg>
      <Text style={{ position: 'absolute', color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{pct}%</Text>
    </View>
  );
}

function GifImageItem({ item, onPress }: { item: GifResult, onPress: () => void }) {
  const theme = useTheme();

  // expo-image handles its own loading skeleton internally — no extra state needed
  return (
    <TouchableOpacity style={styles.gifCell} onPress={onPress}>
      <View style={[styles.gifThumb, { backgroundColor: theme.colors.border ?? '#E5E7EB', overflow: 'hidden' }]}>
        <Image
          source={{ uri: item.previewUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          autoplay
          placeholder={{ thumbhash: undefined, blurhash: undefined }}
          transition={200}
        />
      </View>
    </TouchableOpacity>
  );
}

const GIF_CELL = (SCREEN_WIDTH - 8) / 2;

const styles = StyleSheet.create({
  mediaPreviewContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
  },
  mediaPreviewBox: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBubbleContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  uploadBubble: {
    width: 200,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#333',
    position: 'relative',
  },
  sentCheckmark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandleContainer: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
  },
  mediaPreviewImage: {
    width: '100%',
    height: '100%',
  },
  mediaPreviewDoc: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  mediaPreviewRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'red',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    marginHorizontal: 4,
    paddingRight: 6,
    minHeight: 48,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stickerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  // Attach panel
  attachList: {
    padding: 16,
    gap: 12,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  attachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  attachIcon: {
    width: 48,
    height: 48,
    borderRadius: 16, // More modern squared-circle
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Reply Preview
  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // Removed marginHorizontal to match input bar width exactly
    marginBottom: -1, 
    zIndex: 5,
  },
  replySideBar: {
    width: 3,
    height: '70%', // More elegant partial height bar
    borderRadius: 2,
    marginRight: 12,
  },
  replyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replySender: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  replySnippet: {
    fontSize: 12,
  },
  replyThumbBox: {
    width: 40,
    height: 40,
    borderRadius: 4,
    overflow: 'hidden',
    marginLeft: 8,
  },
  replyThumb: {
    width: '100%',
    height: '100%',
  },
  replyCloseBtn: {
    marginLeft: 10,
    padding: 2,
  },
  attachLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  attachSub: {
    fontSize: 13,
    marginTop: 2,
  },
  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  // Emoji grid
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  emojiCell: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiChar: {
    fontSize: 26,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  // GIF
  gifCell: {
    width: GIF_CELL,
    height: GIF_CELL * 0.75,
    padding: 2,
  },
  gifThumb: {
    flex: 1,
    borderRadius: 8,
  },
  emptyMsg: {
    fontSize: 14,
    marginTop: 16,
  },
});
