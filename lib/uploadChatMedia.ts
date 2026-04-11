import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

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
    const match = cleanUri.match(/\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov|avi|pdf|doc|docx|txt)$/i);
    if (match) {
        ext = match[1].toLowerCase();
    } else if (localUri.startsWith('data:')) {
        const dataMatch = localUri.match(/^data:([^;]+);base64,/);
        if (dataMatch) {
            const mime = dataMatch[1];
            ext = mime.split('/').pop() || 'jpg';
        }
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

    // 2. Platform-agnostic file reading
    let fileToUpload: any;
    try {
        const blobResponse = await fetch(localUri);
        const fileBlob = await blobResponse.blob();
        
        console.log(`[uploadChatMedia] Prepared blob: ${fileBlob.size} bytes, type: ${fileBlob.type || mimeType}`);
        
        if (fileBlob.size === 0) {
            throw new Error('File is empty (0 bytes)');
        }

        if (Platform.OS === 'web') {
            fileToUpload = fileBlob;
        } else {
            // On Native, even if fetch().blob() works, some storage drivers 
            // still prefer the object syntax for file-system efficiency.
            fileToUpload = {
                uri: localUri,
                name: fileName.split('/').pop(),
                type: fileBlob.type || mimeType
            };
        }
    } catch (e) {
        console.warn('[uploadChatMedia] fetch().blob() failed, falling back to basic URI:', e);
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

        if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    onProgress(pct);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress?.(100);
                resolve();
            } else {
                reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
            }
        };
        xhr.onerror = () => reject(new Error('Network error during upload. Please check your connection.'));
        xhr.ontimeout = () => reject(new Error('Upload timed out. The file might be too large.'));
        xhr.timeout = 180_000;
        xhr.send(formData);
    });

    const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(fileName);

    return publicUrl;
}
