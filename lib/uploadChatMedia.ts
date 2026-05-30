import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';

function getMimeType(ext: string): string {
    const map: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        heic: 'image/heic',
        heif: 'image/heif',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        avi: 'video/x-msvideo',
        m4a: 'audio/mp4',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        caf: 'audio/x-caf',
        aac: 'audio/aac',
        '3gp': 'video/3gpp',
        mkv: 'video/x-matroska',
        webm: 'video/webm',
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        txt: 'text/plain',
    };
    return map[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Upload a local URI to Supabase "chat-media" with real-time upload progress.
 */
export async function uploadChatMedia(
    localUri: string,
    folder = 'images',
    onProgress?: (pct: number) => void,
    onXhrCreated?: (xhr: XMLHttpRequest) => void,
): Promise<string> {
    // 1. Extract extension safely
    let ext = 'jpg';
    const cleanUri = localUri.split('?')[0].split('#')[0];
    const match = cleanUri.match(/\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov|avi|m4a|mp3|wav|caf|aac|3gp|mkv|webm|pdf|doc|docx|txt)$/i);
    if (match) {
        ext = match[1].toLowerCase();
    } else if (localUri.startsWith('data:')) {
        const dataMatch = localUri.match(/^data:([^;]+);base64,/);
        if (dataMatch) {
            const mime = dataMatch[1];
            ext = mime.split('/').pop() || 'jpg';
        }
    } else {
        if (folder === 'audio') ext = 'm4a';
        else if (folder === 'videos') ext = 'mp4';
        else if (folder === 'documents') ext = 'pdf';
        else ext = 'jpg';
    }

    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const mimeType = getMimeType(ext);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration');
    }

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token ?? supabaseKey;

    const uploadUrl = `${supabaseUrl}/storage/v1/object/chat-media/${fileName}`;

    if (Platform.OS !== 'web' && !localUri.startsWith('data:')) {
        // Native upload using FileSystem for robustness
        let currentPct = 0;
        
        // Mock progress interval to make it feel fast right away, but constrained
        let mockIntervalId: any = null;
        if (onProgress) {
            onProgress(0);
            mockIntervalId = setInterval(() => {
                if (currentPct < 85) {
                    currentPct += Math.random() > 0.5 ? 2 : 1;
                    onProgress(currentPct);
                }
            }, 400);
        }

        try {
            // Safely get upload type, fallback to 1 (MULTIPART) if enum is missing
            const uploadType = (FileSystem as any).FileSystemUploadType?.MULTIPART ?? 1;
            
            const uploadTask = FileSystem.createUploadTask(
                uploadUrl,
                localUri,
                {
                    httpMethod: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        apikey: supabaseKey,
                        'x-upsert': 'false',
                    },
                    uploadType: uploadType,
                    fieldName: 'file',
                    mimeType: mimeType,
                },
                (data) => {
                    const realPct = Math.round((data.totalBytesSent / data.totalBytesExpectedToSend) * 100);
                    if (realPct > currentPct) {
                        currentPct = realPct;
                        onProgress?.(currentPct);
                    }
                }
            );

            const result = await uploadTask.uploadAsync();
            if (mockIntervalId) clearInterval(mockIntervalId);
            
            if (!result || result.status < 200 || result.status >= 300) {
                throw new Error(`Upload failed (${result?.status}): ${result?.body}`);
            }
            
            onProgress?.(100);
        } catch (e: any) {
            if (mockIntervalId) clearInterval(mockIntervalId);
            console.error('[uploadChatMedia] FileSystem upload error:', e);
            throw new Error(e.message || 'Network error during upload. Please check your connection.');
        }
    } else {
        // Web fallback or Data URI fallback using XHR
        let fileToUpload: any;
        try {
            const blobResponse = await fetch(localUri);
            const fileBlob = await blobResponse.blob();
            
            if (fileBlob.size === 0) {
                throw new Error('File is empty (0 bytes)');
            }
            
            fileToUpload = fileBlob;
        } catch (e) {
            console.warn('[uploadChatMedia] fetch().blob() failed, using blob fallback for basic URI:', e);
            fileToUpload = {
                uri: localUri,
                name: fileName.split('/').pop(),
                type: mimeType
            };
        }

        const formData = new FormData();
        formData.append('file', fileToUpload, fileName);

        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', uploadUrl);
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
            xhr.setRequestHeader('apikey', supabaseKey);
            xhr.setRequestHeader('x-upsert', 'false');

            onXhrCreated?.(xhr);

            let currentPct = 0;
            let intervalId: any = null;

            if (onProgress) {
                onProgress(0);
                intervalId = setInterval(() => {
                    if (currentPct < 95) {
                        const remaining = 95 - currentPct;
                        let step = 1;
                        if (remaining > 50) {
                            step = Math.floor(Math.random() * 3) + 2;
                        } else if (remaining > 20) {
                            step = Math.floor(Math.random() * 2) + 1;
                        } else {
                            step = Math.random() < 0.3 ? 1 : 0;
                        }
                        currentPct = Math.min(95, currentPct + step);
                        onProgress(currentPct);
                    }
                }, 350);
            }

            if (xhr.upload && onProgress) {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const realPct = Math.round((e.loaded / e.total) * 100);
                        if (realPct > currentPct) {
                            currentPct = realPct;
                            onProgress(currentPct);
                        }
                    }
                };
            }

            xhr.onload = () => {
                if (intervalId) clearInterval(intervalId);
                if (xhr.status >= 200 && xhr.status < 300) {
                    onProgress?.(100);
                    resolve();
                } else {
                    reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
                }
            };
            xhr.onerror = () => {
                if (intervalId) clearInterval(intervalId);
                reject(new Error('Network error during upload. Please check your connection.'));
            };
            xhr.ontimeout = () => {
                if (intervalId) clearInterval(intervalId);
                reject(new Error('Upload timed out. The file might be too large.'));
            };
            xhr.timeout = 180_000;
            xhr.send(formData);
        });
    }

    const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(fileName);

    return publicUrl;
}
