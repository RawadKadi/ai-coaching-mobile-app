import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

type DownloadStatus = 'idle' | 'downloading' | 'finished' | 'error';

type DownloadState = {
    url: string;
    fileUri: string;
    progress: number; // 0–100
    status: DownloadStatus;
    localUri: string | null;
};

type Listener = (state: DownloadState) => void;

class MediaDownloadManager {
    private downloads: Map<string, DownloadState> = new Map();
    private listeners: Map<string, Set<Listener>> = new Map();

    async getOrDownload(url: string): Promise<string | null> {
        if (!url || !url.startsWith('http')) return url || null;

        // Web: file system is not available — use remote URL directly
        if (Platform.OS === 'web') return url;

        // 1. Already in memory and finished — return immediately
        const existing = this.downloads.get(url);
        if (existing) {
            if (existing.status === 'finished' && existing.localUri) return existing.localUri;
            if (existing.status === 'downloading') return null; // Wait for subscription
            if (existing.status === 'error') return url; // Fallback to remote
        }

        // 2. Check disk (persistent cache survives app restarts)
        const filename = this._filename(url);
        const fileUri = `${FileSystem.documentDirectory}media_cache/${filename}`;

        try {
            const info = await FileSystem.getInfoAsync(fileUri);
            if (info.exists) {
                // Populate memory so future calls are sync
                this._setState(url, { url, fileUri, progress: 100, status: 'finished', localUri: fileUri });
                return fileUri;
            }
        } catch (e) {
            console.warn('[MediaManager] getInfoAsync failed:', e);
        }

        // 3. Not cached — start download
        this._startDownload(url, fileUri);
        return null;
    }

    private _filename(url: string): string {
        // Use a hash of the full URL to prevent any filename collisions
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            hash = ((hash << 5) - hash) + url.charCodeAt(i);
            hash |= 0;
        }
        const ext = url.split('?')[0].split('.').pop()?.slice(0, 4) || 'bin';
        return `${Math.abs(hash).toString(36)}.${ext}`;
    }

    private async _startDownload(url: string, fileUri: string) {
        if (Platform.OS === 'web') return;

        // Ensure cache directory exists
        try {
            await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}media_cache/`, { intermediates: true });
        } catch {}

        this._setState(url, { url, fileUri, progress: 0, status: 'downloading', localUri: null });

        const resumable = FileSystem.createDownloadResumable(
            url,
            fileUri,
            {},
            (downloadProgress) => {
                const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
                // Guard against unknown content-length (-1)
                const pct = totalBytesExpectedToWrite > 0
                    ? Math.min(99, Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100))
                    : Math.min(99, Math.round(totalBytesWritten / 10000)); // fallback: KB written
                const cur = this.downloads.get(url);
                if (cur) this._setState(url, { ...cur, progress: pct });
            }
        );

        try {
            const result = await resumable.downloadAsync();
            if (result?.uri) {
                this._setState(url, { url, fileUri: result.uri, progress: 100, status: 'finished', localUri: result.uri });
            } else {
                this._setState(url, { url, fileUri, progress: 0, status: 'error', localUri: null });
            }
        } catch (error: any) {
            console.warn('[MediaManager] download failed:', error?.message || error);
            this._setState(url, { url, fileUri, progress: 0, status: 'error', localUri: null });
        }
    }

    private _setState(url: string, state: DownloadState) {
        this.downloads.set(url, state);
        this._notify(url, state);
    }

    subscribe(url: string, listener: Listener): () => void {
        if (!this.listeners.has(url)) {
            this.listeners.set(url, new Set());
        }
        this.listeners.get(url)!.add(listener);

        // Fire immediately with current state if we have one
        const state = this.downloads.get(url);
        if (state) listener(state);

        return () => {
            this.listeners.get(url)?.delete(listener);
        };
    }

    private _notify(url: string, state: DownloadState) {
        this.listeners.get(url)?.forEach(listener => listener(state));
    }

    getState(url: string): DownloadState | undefined {
        return this.downloads.get(url);
    }

    /** Pre-warm: tell manager a remote URL is now available (e.g. after upload) */
    markRemoteAvailable(url: string) {
        if (!url || !url.startsWith('http')) return;
        const existing = this.downloads.get(url);
        if (!existing || existing.status !== 'finished') {
            // Kick off download so next open is instant
            this.getOrDownload(url);
        }
    }
}

export const mediaDownloadManager = new MediaDownloadManager();
