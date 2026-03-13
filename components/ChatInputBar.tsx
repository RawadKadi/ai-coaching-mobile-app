import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Keyboard, Animated, ScrollView, FlatList,
  Platform, Dimensions, ActivityIndicator, Alert,
  KeyboardAvoidingView, Easing, PanResponder
} from 'react-native';
import { Image } from 'expo-image'; // disk-cached, hardware-accelerated
import Svg, { Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/contexts/BrandContext';
import { Send, Paperclip, Smile, Camera, X, Search, Film, Image as ImageIcon, FileText, ClipboardPaste } from 'lucide-react-native';
import { EMOJIS_BY_CATEGORY, EMOJI_SEARCH } from '@/lib/emojiData';
import { uploadChatMedia } from '@/lib/uploadChatMedia';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = 310;
const PANEL_FULL_HEIGHT = SCREEN_HEIGHT * 0.9;
const TENOR_KEY = process.env.EXPO_PUBLIC_TENOR_API_KEY;

interface GifResult { id: string; previewUrl: string; url: string; }

interface Props {
  /** Called when user sends a plain text message */
  onSendText: (text: string) => Promise<void>;
  /** Called when user sends a media message — receives JSON string content */
  onSendMedia: (jsonContent: string) => Promise<void>;
  sending?: boolean;
  placeholder?: string;
}

type Panel = 'emoji' | 'attach' | null;

export function ChatInputBar({ onSendText, onSendMedia, sending, placeholder = 'Message…' }: Props) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [emojiTab, setEmojiTab] = useState<'emoji' | 'gif'>('emoji');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifLoadingMore, setGifLoadingMore] = useState(false);
  const [gifHasMore, setGifHasMore] = useState(true);
  const [gifOffset, setGifOffset] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState<{ uri: string, type: string } | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string, type: string, fileName?: string, mimeType?: string } | null>(null);
  const [hasClipboardImage, setHasClipboardImage] = useState(false);
  const [deferRender, setDeferRender] = useState(false);

  const panelHeightAnim = useRef(new Animated.Value(0)).current;
  const currentHeight = useRef(0);
  const startHeight = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

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
        startHeight.current = currentHeight.current;
        panelHeightAnim.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        let proposedTotalHeight = startHeight.current - gestureState.dy;
        let animatedValue = -gestureState.dy;
        
        if (proposedTotalHeight > PANEL_FULL_HEIGHT) {
           let excess = proposedTotalHeight - PANEL_FULL_HEIGHT;
           proposedTotalHeight = PANEL_FULL_HEIGHT + excess * 0.3;
           animatedValue = proposedTotalHeight - startHeight.current;
        } else if (proposedTotalHeight < 0) {
           animatedValue = -startHeight.current; // Prevent shrinking below 0 width
        }
        
        panelHeightAnim.setValue(animatedValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        panelHeightAnim.flattenOffset();
        const start = startHeight.current;
        const dy = gestureState.dy; // positive = dragged down
        const vy = gestureState.vy;

        let target = PANEL_HEIGHT;

        if (Math.abs(start - PANEL_FULL_HEIGHT) < 50) {
          // Started from EXPANDED (Top)
          if (dy > 300 || vy > 1.5) {
             target = 0; // Dragged down a LOT -> Close
          } else if (dy > 50 || vy > 0.3) {
             target = PANEL_HEIGHT; // Dragged down a bit -> Middle
          } else {
             target = PANEL_FULL_HEIGHT; // Stay Expanded
          }
        } else {
          // Started from MIDDLE
          if (dy < -20 || vy < -0.1) {
             target = PANEL_FULL_HEIGHT; // Dragged up even a bit -> Expand
          } else if (dy > 50 || vy > 0.3) {
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
            tension: 50,
            friction: 8,
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
    
    // Defer heavy rendering until animation starts
    setTimeout(() => setDeferRender(true), 50);
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
        const hasImg = await Clipboard.hasImageAsync();
        setHasClipboardImage(hasImg);
      } catch (e) {}
    };
    checkClipboard();
    const sub = Clipboard.addClipboardListener(checkClipboard);
    return () => Clipboard.removeClipboardListener(sub);
  }, []);

  // ─── Send text & media ─────────────────────────────────────────────────────

  const handleSend = async () => {
    const msg = text.trim();
    if ((!msg && !selectedMedia) || sending || uploading) return;

    setText('');
    const mediaToUpload = selectedMedia;
    setSelectedMedia(null);

    if (mediaToUpload) {
      setUploading(true);
      setUploadProgress(0);
      // Show local preview immediately (optimistic bubble)
      setUploadingMedia({ uri: mediaToUpload.uri, type: mediaToUpload.type });
      try {
        const isVideo = mediaToUpload.type === 'video';
        const isDoc = mediaToUpload.type === 'document';
        const url = await uploadChatMedia(
          mediaToUpload.uri,
          isDoc ? 'documents' : isVideo ? 'videos' : 'images',
          (pct) => setUploadProgress(pct),
        );

        // Upload is done — show 100% briefly, then tell parent to insert into DB
        setUploadProgress(100);
        await onSendMedia(JSON.stringify({
          type: isDoc ? 'document' : isVideo ? 'video' : 'image',
          url,
          fileName: mediaToUpload.fileName,
          mimeType: mediaToUpload.mimeType
        }));
        // Realtime will deliver the real message within ~500ms;
        // give it a moment before clearing the optimistic bubble
        setTimeout(() => {
          setUploadingMedia(null);
          setUploadProgress(0);
        }, 600);
      } catch (error: any) {
        console.error('Error sending media:', error);
        Alert.alert('Upload failed', error?.message || 'Could not upload the file.');
        setSelectedMedia(mediaToUpload);
        setText(msg);
        setUploadingMedia(null);
        setUploadProgress(0);
      } finally {
        setUploading(false);
      }
    }

    if (msg) {
      await onSendText(msg);
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

  // ─── Emoji ─────────────────────────────────────────────────────────────────

  const onEmojiTap = (emoji: string) => {
    setText(prev => prev + emoji);
    // Keep panel open so user can pick multiple emojis
  };

  // Filter emojis by search term
  const filteredEmojis: string[] = emojiSearch.trim()
    ? EMOJI_SEARCH.filter(e => e.name.includes(emojiSearch.toLowerCase())).map(e => e.char)
    : [];

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

  // Fetch trending globally when GIF tab opened / cleared
  React.useEffect(() => {
    if (activePanel === 'emoji' && emojiTab === 'gif' && !gifQuery.trim()) {
      searchGifs('');
    }
  }, [activePanel, emojiTab, gifQuery, searchGifs]);

  const handleSendGif = (gif: GifResult) => {
    const payload = {
      type: 'gif',
      url: gif.url,
      previewUrl: gif.previewUrl,
      id: gif.id
    };
    onSendMedia(JSON.stringify(payload));
    togglePanel(null); // Changed closePanel() to togglePanel(null)
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const isDisabled = sending || uploading;

  return (
    <View style={{ backgroundColor: theme.colors.surface }}>
      {/* ── Optional Media Preview ───────────────────────────────────────────── */}
      {selectedMedia && (
        <View style={styles.mediaPreviewContainer}>
          <View style={[styles.mediaPreviewBox, { borderColor: theme.colors.border }]}>
            {selectedMedia.type === 'image' || selectedMedia.type === 'video' ? (
              <Image source={{ uri: selectedMedia.uri }} style={styles.mediaPreviewImage} />
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

      {/* ── Optimistic upload bubble (sender) ── */}
      {uploadingMedia && (
        <View style={styles.uploadBubbleContainer}>
          <View style={styles.uploadBubble}>
            {(uploadingMedia.type === 'image' || uploadingMedia.type === 'video') ? (
              <Image
                source={{ uri: uploadingMedia.uri }}
                style={{ width: 200, height: 180 }}
                contentFit="cover"
                cachePolicy="memory"
              />
            ) : (
              <View style={{ width: 200, height: 180, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
                <FileText size={32} color="#FFFFFF" />
              </View>
            )}

            {/* Semi-transparent overlay + progress ring */}
            <View style={[StyleSheet.absoluteFill, {
              backgroundColor: uploadProgress >= 100 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.45)',
              justifyContent: 'center',
              alignItems: 'center',
            }]}>
              {uploadProgress >= 100 ? (
                // Sent! Show a subtle checkmark
                <View style={styles.sentCheckmark}>
                  <Text style={{ color: '#FFFFFF', fontSize: 22 }}>✓</Text>
                </View>
              ) : (
                <CircularProgress pct={uploadProgress} />
              )}
            </View>
          </View>
        </View>
      )}

      {/* ── Input row ──────────────────────────────────────────────────────── */}
      <View style={[
        styles.inputRow,
        { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
        Platform.OS === 'ios' ? { paddingBottom: (activePanel || isKeyboardVisible) ? 8 : 24 } : { paddingBottom: 12 },
      ]}>

        {/* Attach */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => togglePanel('attach')}
          activeOpacity={0.7}
          disabled={isDisabled}
        >
          <Paperclip
            size={22}
            color={activePanel === 'attach' ? theme.colors.primary : theme.colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Emoji / GIF */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => togglePanel('emoji')}
          activeOpacity={0.7}
          disabled={isDisabled}
        >
          <Smile
            size={22}
            color={activePanel === 'emoji' ? theme.colors.primary : theme.colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.inputBackground ?? theme.colors.surfaceAlt,
              color: theme.colors.text,
              fontFamily: theme.typography.fontFamily,
            },
          ]}
          placeholder={uploading ? 'Uploading…' : placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          value={text}
          onChangeText={setText}
          onFocus={onInputFocus}
          multiline
          editable={!isDisabled}
        />

        {/* Upload spinner or Send */}
        {uploading ? (
          <View style={styles.sendBtn}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: theme.colors.primary },
              ((!text.trim() && !selectedMedia) || isDisabled) && { opacity: 0.5 },
            ]}
            onPress={handleSend}
            disabled={(!text.trim() && !selectedMedia) || isDisabled}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Sliding panel ──────────────────────────────────────────────────── */}
      {activePanel && (
        <Animated.View
          style={[
            styles.panel,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
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
              <Text style={[styles.panelTitle, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
                Send file
              </Text>
              
              <TouchableOpacity style={[styles.attachItem, { borderColor: theme.colors.border }]} onPress={pickFromLibrary}>
                <View style={[styles.attachIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
                  <ImageIcon size={24} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={[styles.attachLabel, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>Photo / Video</Text>
                  <Text style={[styles.attachSub, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>From your library</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.attachItem, { borderColor: theme.colors.border }]} onPress={openCamera}>
                <View style={[styles.attachIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
                  <Camera size={24} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={[styles.attachLabel, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>Camera</Text>
                  <Text style={[styles.attachSub, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>Take a photo</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.attachItem, { borderColor: theme.colors.border }]} onPress={pickDocument}>
                <View style={[styles.attachIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
                  <FileText size={24} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={[styles.attachLabel, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>Document</Text>
                  <Text style={[styles.attachSub, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>PDF, Word, etc.</Text>
                </View>
              </TouchableOpacity>

              {hasClipboardImage && (
                <TouchableOpacity style={[styles.attachItem, { borderColor: theme.colors.border, borderBottomWidth: 0 }]} onPress={pasteFromClipboard}>
                  <View style={[styles.attachIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
                    <ClipboardPaste size={24} color={theme.colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.attachLabel, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}>Paste Image</Text>
                    <Text style={[styles.attachSub, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>From clipboard</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Emoji / GIF panel ────────────────────────────────────────── */}
          {activePanel === 'emoji' && (
            <View style={{ flex: 1 }}>
              {/* Tabs */}
              <View style={[styles.tabs, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={[styles.tab, emojiTab === 'emoji' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
                  onPress={() => setEmojiTab('emoji')}
                >
                  <Text style={[styles.tabText, { color: emojiTab === 'emoji' ? theme.colors.primary : theme.colors.textSecondary }]}>
                    😊 Emoji
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, emojiTab === 'gif' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
                  onPress={() => setEmojiTab('gif')}
                >
                  <Text style={[styles.tabText, { color: emojiTab === 'gif' ? theme.colors.primary : theme.colors.textSecondary }]}>
                    🎞 GIF
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Search bar */}
              <View style={[styles.searchRow, { backgroundColor: theme.colors.surfaceAlt ?? theme.colors.background }]}>
                <Search size={16} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text, fontFamily: theme.typography.fontFamily }]}
                  placeholder={emojiTab === 'emoji' ? 'Search emoji…' : 'Search GIFs…'}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={emojiTab === 'emoji' ? emojiSearch : gifQuery}
                  onChangeText={(v) => {
                    if (emojiTab === 'emoji') {
                      setEmojiSearch(v);
                    } else {
                      setGifQuery(v);
                      searchGifs(v, 0, false);
                    }
                  }}
                />
                {(emojiTab === 'emoji' ? emojiSearch : gifQuery).length > 0 && (
                  <TouchableOpacity onPress={() => {
                    if (emojiTab === 'emoji') setEmojiSearch('');
                    else { setGifQuery(''); setGifResults([]); }
                  }}>
                    <X size={16} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Emoji tab content */}
              {emojiTab === 'emoji' && (
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  {!deferRender ? (
                    <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} />
                  ) : emojiSearch.trim() ? (
                    /* Search results */
                    <View style={styles.emojiGrid}>
                      {filteredEmojis.length === 0 ? (
                        <Text style={[styles.emptyMsg, { color: theme.colors.textSecondary }]}>No results</Text>
                      ) : filteredEmojis.map((emoji, i) => (
                        <TouchableOpacity key={i} style={styles.emojiCell} onPress={() => onEmojiTap(emoji)}>
                          <Text style={styles.emojiChar}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    /* Categories */
                    EMOJIS_BY_CATEGORY.map((cat) => (
                      <View key={cat.label}>
                        <Text style={[styles.catLabel, { color: theme.colors.textSecondary, fontFamily: theme.typography.fontFamily }]}>
                          {cat.label}
                        </Text>
                        <View style={styles.emojiGrid}>
                          {cat.emojis.map((emoji, i) => (
                            <TouchableOpacity key={i} style={styles.emojiCell} onPress={() => onEmojiTap(emoji)}>
                              <Text style={styles.emojiChar}>{emoji}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              )}

              {/* GIF tab content */}
              {emojiTab === 'gif' && (
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
              )}
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
    backgroundColor: '#D1D5DB', // fallback
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
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 36,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
