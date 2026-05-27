# 613 Barbershop — V3

## Project
React Native barbershop app for 613 Barbershop, 598 Rideau St, Ottawa ON.
Active branch: v3 | Main branch = V2 (never touch main)

## Stack
React Native, Expo SDK 54, Firebase (Firestore/Auth/Storage), 
Anthropic Claude API, OpenAI API (gpt-image-1 edits), ImgBB, TypeScript

## V3 Status
- StyleDocumentScreen simplified (photo + description only) — DONE
- RatingModal Google Reviews redirect — DONE  
- StylesScreen rebuilt as Style with AI chat + gpt-image-1 hair try-on — DONE
- ClientNavigator merged AI Chat + Styles into one Style AI tab — DONE
- Website booking connection — TODO

## Key Rules
- Always on v3 branch, never modify main
- TextInput color must be in StyleSheet (#FFFFFF), not as a prop
- Use expo-file-system/legacy not expo-file-system
- Commit prefix: "v3: description"
- gpt-image-1 edits endpoint takes real photo as FormData, returns base64
