import { useAudioPlayer } from 'expo-audio';

// Both send and receive use the same crisp pop sound
const POP_SOUND = require('../assets/sounds/message_pop.mp3');

/**
 * Hook that provides `playReceive()` and `playSend()` for
 * quick pop-style message sounds.
 *
 * Players are pre-loaded once when the hook mounts so that
 * playback is instant with zero latency.
 */
export function useChatSound() {
  const receivePlayer = useAudioPlayer(POP_SOUND);
  const sendPlayer = useAudioPlayer(POP_SOUND);

  const playReceive = () => {
    try {
      receivePlayer.seekTo(0);
      receivePlayer.play();
    } catch (e) {
      // Silently ignore — sound is non-critical
    }
  };

  const playSend = () => {
    try {
      sendPlayer.seekTo(0);
      sendPlayer.play();
    } catch (e) {
      // Silently ignore — sound is non-critical
    }
  };

  return { playReceive, playSend };
}
