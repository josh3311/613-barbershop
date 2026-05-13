# 613 Barbershop — Deployment Guide

## Prerequisites
- Apple Developer Account ($99/year)
- Google Play Console Account ($25 one-time)
- EAS CLI: npm install -g eas-cli
- Logged in: eas login

## iOS — TestFlight
1. eas build --platform ios --profile production
2. eas submit --platform ios --profile production
3. App Store Connect → TestFlight → add testers

## Android — Play Store
1. eas build --platform android --profile production
2. eas submit --platform android --profile production
3. Play Console → Internal Testing → promote

## Environment Variables (add in EAS Dashboard)
- EXPO_PUBLIC_ANTHROPIC_API_KEY
- EXPO_PUBLIC_FIREBASE_API_KEY
- EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
- EXPO_PUBLIC_FIREBASE_PROJECT_ID
- EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
- EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- EXPO_PUBLIC_FIREBASE_APP_ID

## Firebase Production Files
- google-services.json → Firebase Console → Android App
- GoogleService-Info.plist → Firebase Console → iOS App
- Place both at project root
