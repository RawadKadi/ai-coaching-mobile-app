import * as FileSystem from 'expo-file-system/legacy';

type DownloadState = {
    url: string;
    fileUri: string;
    progress: number;
    status: 'idle' | 'downloading' | 'finished' | 'error';
    localUri: string | null;
    resumable: FileSystem.DownloadResumable | null;
};

type Listener = (state: DownloadState) => void;

class MediaDownloadManager {
    private downloads: Map<string, DownloadState> = new Map();
    private listeners: Map<string, Set<Listener>> = new Map();

    async getOrDownload(url: string): Promise<string | null> {
        if (!url || !url.startsWith('http')) return url || null;

        const filename = url.split('/').pop()?.split('?')[0] || `cache_${Date.now()}`;
        const fileUri = `${FileSystem.documentDirectory}${filename}`;

        // 1. Check if already finished
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
            return fileUri;
        }

        // 2. Check if already downloading
        if (this.downloads.has(url)) {
            const state = this.downloads.get(url)!;
            if (state.status === 'finished') return state.localUri;
            return null; // Still downloading
        }

        // 3. Start new download
        this.startDownload(url, fileUri);
        return null;
    }

    private startDownload(url: string, fileUri: string) {
        const state: DownloadState = {
            url,
            fileUri,
            progress: 0,
            status: 'downloading',
            localUri: null,
            resumable: null
        };

        this.downloads.set(url, state);

        const resumable = FileSystem.createDownloadResumable(
            url,
            fileUri,
            {},
            (downloadProgress) => {
                const progress = (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100;
                this.updateState(url, { progress: Math.round(progress) });
            }
        );

        state.resumable = resumable;

        resumable.downloadAsync()
            .then((result) => {
                if (result) {
                    this.updateState(url, { 
                        status: 'finished', 
                        localUri: result.uri, 
                        progress: 100 
                    });
                }
            })
            .catch((error) => {
                console.warn('[MediaManager] Download failed:', error);
                this.updateState(url, { status: 'error' });
            });
    }

    private updateState(url: string, update: Partial<DownloadState>) {
        const state = this.downloads.get(url);
        if (state) {
            const newState = { ...state, ...update };
            this.downloads.set(url, newState);
            this.notify(url, newState);
        }
    }

    subscribe(url: string, listener: Listener) {
        if (!this.listeners.has(url)) {
            this.listeners.set(url, new Set());
        }
        this.listeners.get(url)!.add(listener);

        // Immediate first call if state exists
        const state = this.downloads.get(url);
        if (state) listener(state);

        return () => {
            this.listeners.get(url)?.delete(listener);
        };
    }

    private notify(url: string, state: DownloadState) {
        this.listeners.get(url)?.forEach(listener => listener(state));
    }

    getState(url: string): DownloadState | undefined {
        return this.downloads.get(url);
    }
}

export const mediaDownloadManager = new MediaDownloadManager();
