import { supabase } from '@/lib/supabase';

function getMimeType(ext: string): string {
    const map: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
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
 * Uses XMLHttpRequest so we can get precise onprogress events (unlike fetch).
 *
 * @param localUri - Local file URI from expo-image-picker / expo-document-picker
 * @param folder   - Bucket subfolder: 'images' | 'videos' | 'documents'
 * @param onProgress - callback(0–100) called repeatedly as bytes are sent
 * @returns Public URL of the uploaded file
 */
export async function uploadChatMedia(
    localUri: string,
    folder = 'images',
    onProgress?: (pct: number) => void,
): Promise<string> {
    const ext = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
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

    // FormData – React Native streams this natively to avoid loading file into JS memory
    const formData = new FormData();
    // @ts-ignore – RN accepts { uri, name, type } here
    formData.append('file', { uri: localUri, name: `upload.${ext}`, type: mimeType });

    await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('apikey', supabaseKey);
        xhr.setRequestHeader('x-upsert', 'false');

        // ── Real upload progress ──────────────────────────────────────────────
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
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.timeout = 120_000; // 2 min max
        xhr.send(formData);
    });

    // Return the public URL
    const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(fileName);

    return publicUrl;
}
