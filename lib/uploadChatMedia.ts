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
 * Upload a local URI (from expo-image-picker or expo-document-picker) to
 * the Supabase "chat-media" storage bucket.
 * Returns the public URL of the uploaded file.
 */
export async function uploadChatMedia(localUri: string, folder = 'images'): Promise<string> {
    // Determine extension
    const ext = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const mimeType = getMimeType(ext);

    // Fetch the file from the local URI as a Blob
    const response = await fetch(localUri);
    const blob = await response.blob();

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(fileName, blob, {
            contentType: mimeType,
            upsert: false,
        });

    if (error) throw error;

    // Return the public URL
    const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(fileName);

    return publicUrl;
}
