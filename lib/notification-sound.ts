import { Audio } from 'expo-av';

let notificationSound: Audio.Sound | null = null;

export async function loadNotificationSound() {
    // Sound is optional - app works without it
    try {
        const { sound } = await Audio.Sound.createAsync(
            require('../assets/sounds/notification.mp3'),
            { shouldPlay: false }
        );
        notificationSound = sound;
        console.log('✅ Notification sound loaded');
    } catch (error) {
        // Sound file doesn't exist - that's okay
        console.log('ℹ️  Notification sound not available (silent mode)');
        notificationSound = null;
    }
}

export async function playNotificationSound() {
    try {
        if (notificationSound) {
            await notificationSound.replayAsync();
        }
    } catch (error) {
        console.log('Error playing notification sound:', error);
    }
}

export async function unloadNotificationSound() {
    try {
        if (notificationSound) {
            await notificationSound.unloadAsync();
            notificationSound = null;
        }
    } catch (error) {
        console.log('Error unloading notification sound:', error);
    }
}
