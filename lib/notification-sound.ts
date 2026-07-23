import { createAudioPlayer, AudioPlayer } from 'expo-audio';

// Pre-load sounds for zero latency playback
let notificationPlayer: AudioPlayer | null = null;

// The pop sound used for all notifications
const SOUND_ASSET = require('../assets/sounds/message_pop.mp3');

export function loadNotificationSound() {
  try {
    notificationPlayer = createAudioPlayer(SOUND_ASSET);
    console.log('✅ Notification sound loaded');
  } catch (error) {
    console.log('ℹ️  Notification sound not available (silent mode)');
    notificationPlayer = null;
  }
}

export function playNotificationSound() {
  try {
    if (notificationPlayer) {
      notificationPlayer.seekTo(0);
      notificationPlayer.play();
    }
  } catch (error) {
    console.log('Error playing notification sound:', error);
  }
}

export function unloadNotificationSound() {
  try {
    if (notificationPlayer) {
      notificationPlayer.remove();
      notificationPlayer = null;
    }
  } catch (error) {
    console.log('Error unloading notification sound:', error);
  }
}
