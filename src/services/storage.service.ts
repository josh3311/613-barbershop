/**
 * Firebase Storage uploads. Ensure Storage rules allow authenticated users to write
 * `barber-profiles/{uid}/profile` (and public read if clients must load barber avatars).
 */
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { FirestoreResult } from '@/types/common.types';

function profileObjectPath(uid: string): string {
  return `barber-profiles/${uid}/profile`;
}

export const StorageService = {
  /**
   * Uploads a local image (file URI from ImagePicker) and returns the download URL.
   * Overwrites the same object path so the barber always has one profile image.
   */
  async uploadBarberProfilePhoto(
    uid: string,
    localUri: string,
    mimeType?: string | null,
  ): Promise<FirestoreResult<string>> {
    try {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const contentType =
        mimeType ||
        (blob.type && blob.type !== 'application/octet-stream' ? blob.type : null) ||
        'image/jpeg';

      const storageRef = ref(storage, profileObjectPath(uid));
      await uploadBytes(storageRef, blob, { contentType });
      const url = await getDownloadURL(storageRef);
      return { success: true, data: url };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
} as const;
