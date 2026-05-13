# 613 Barbershop — CI/CD Guide

## Pipeline Overview

| Trigger | Workflow | Action |
|---------|----------|--------|
| Push to v2-rebuild | ci.yml | TypeScript check |
| Pull Request to main | preview.yml | EAS preview build |
| PR opened/updated | pr-checks.yml | Quality gate + PR comment |
| Push to main | deploy.yml | Production build + store submit |

## Required GitHub Secrets
Add these in GitHub → Settings → Secrets → Actions:

| Secret | Where to get it |
|--------|----------------|
| EXPO_TOKEN | expo.dev → Account Settings → Access Tokens |
| EXPO_PUBLIC_ANTHROPIC_API_KEY | Anthropic Console |
| EXPO_PUBLIC_FIREBASE_API_KEY | Firebase Console |
| EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN | Firebase Console |
| EXPO_PUBLIC_FIREBASE_PROJECT_ID | Firebase Console |
| EXPO_PUBLIC_FIREBASE_APP_ID | Firebase Console |

## Branch Strategy
- v2-rebuild → active development (CI runs on every push)
- main → production (triggers store deployment)
- feature/* → feature branches (PR required to merge)

## How to Deploy
1. Finish feature on v2-rebuild
2. Open PR from v2-rebuild → main
3. CI runs automatically — must pass to merge
4. Merge PR → deploy.yml triggers automatically
5. App lands in TestFlight + Play Store internal track
