import { Platform } from 'react-native';

export const theme = {
  colors: {
    // Core backgrounds
    background:     '#0A0A0A',
    surface:        '#141414',
    surfaceElevated:'#1C1C1C',
    card:           '#1A1A1A',
    border:         '#2A2A2A',

    // Brand
    gold:           '#D4AF37',
    goldLight:      '#E8C84A',
    goldDark:       '#B8941F',
    goldMuted:      'rgba(212, 175, 55, 0.15)',

    // Text
    textPrimary:    '#FFFFFF',
    textSecondary:  '#A0A0A0',
    textMuted:      '#555555',
    textInverse:    '#0A0A0A',

    // Status
    success:        '#4CAF50',
    error:          '#FF4444',
    warning:        '#FF9800',
    info:           '#2196F3',

    // Booking status
    pending:        '#FF9800',
    confirmed:      '#4CAF50',
    completed:      '#D4AF37',
    cancelled:      '#FF4444',

    // Overlays
    overlay:        'rgba(0, 0, 0, 0.7)',
    overlayLight:   'rgba(0, 0, 0, 0.4)',
  },

  fonts: {
    heading:  'BebasNeue_400Regular',
    body:     'Inter_400Regular',
    medium:   'Inter_600SemiBold',
    bold:     'Inter_700Bold',
  },

  fontSizes: {
    xs:   11,
    sm:   13,
    md:   15,
    lg:   17,
    xl:   20,
    xxl:  24,
    xxxl: 32,
    hero: 48,
  },

  spacing: {
    xs:   4,
    sm:   8,
    md:   16,
    lg:   24,
    xl:   32,
    xxl:  48,
  },

  radius: {
    sm:     8,
    md:     12,
    lg:     16,
    xl:     24,
    full:   999,
  },

  // 3D card shadows — matches your existing semi-3D style
  shadows: {
    sm: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
    md: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
    gold: Platform.select({
      ios: {
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },

  // Booking status → color mapping (used in cards)
  statusColors: {
    pending:   '#FF9800',
    confirmed: '#4CAF50',
    completed: '#D4AF37',
    cancelled: '#FF4444',
  },
} as const;

export type Theme = typeof theme;