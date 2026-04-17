/**
 * Expo push: registers device token on `users/{uid}.fcmToken` (stores Expo push token string).
 * Sending notifications when booking status changes requires a trusted server (Expo Push API,
 * Cloud Function, etc.) — see PROJECT_STATUS.md.
 */
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { UserService } from '@/services/user.service';

let handlerReady = false;

export function configureNotificationHandler(): void {
  if (handlerReady) return;
  handlerReady = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export const PushService = {
  async register(uid: string): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }

      const { status: existing } = await Notifications.getPermissionsAsync();
      let next = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        next = status;
      }
      if (next !== 'granted') return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
      if (!projectId || typeof projectId !== 'string') {
        return;
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      if (!token) return;

      const res = await UserService.update(uid, { fcmToken: token });
      if (!res.success) {
        return;
      }
    } catch {
      // Simulators / misconfigured EAS project — ignore
    }
  },
} as const;
