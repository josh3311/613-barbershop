/**
 * 613 Barbershop Design System
 * Centralized theme for consistent UI/UX across the app
 */

// ==========================================
// COLOR PALETTE
// ==========================================
export const colors = {
  // Backgrounds
  background: '#0A0A0A',
  surface: '#111111',
  surfaceRaised: '#1A1A1A',

  // Borders & Dividers
  border: '#2A2A2A',
  borderSubtle: '#1E1E1E',

  // Brand Colors
  gold: '#D4AF37',
  goldDim: '#9A7B20',
  goldGlow: 'rgba(212, 175, 55, 0.15)',
  goldGlowStrong: 'rgba(212, 175, 55, 0.3)',

  // Text Colors
  white: '#FFFFFF',
  grey: '#888888',
  greyDark: '#666666',

  // Semantic Colors
  red: '#E53935',
  green: '#2E7D32',

  // Legacy compatibility (for gradual migration)
  bg: '#0A0A0A',
  card: '#111111',
  elevated: '#1A1A1A',
  cardBorder: '#2A2A2A',
  goldBorder: 'rgba(212, 175, 55, 0.3)',
  sub: '#888888',
  muted: '#666666',
  divider: '#1E1E1E',
  blue: '#2196F3',
} as const;

// ==========================================
// TYPOGRAPHY
// ==========================================
export const fonts = {
  // Font families (loaded via expo-google-fonts)
  heading: 'BebasNeue_400Regular',
  body: 'Inter_400Regular',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',

  // Font sizes
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
    '6xl': 36,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 1,
    wider: 1.5,
    widest: 2,
  },
} as const;

// ==========================================
// SPACING
// ==========================================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

// ==========================================
// BORDER RADIUS
// ==========================================
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// ==========================================
// SHADOWS / ELEVATION
// ==========================================
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  gold: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
} as const;

// ==========================================
// ICON NAMES (Ionicons)
// ==========================================
export const icons = {
  // Tab icons
  tabHome: 'home',
  tabHomeOutline: 'home-outline',
  tabBook: 'calendar',
  tabBookOutline: 'calendar-outline',
  tabStyle: 'cut',
  tabStyleOutline: 'cut-outline',
  tabHistory: 'time',
  tabHistoryOutline: 'time-outline',
  tabProfile: 'person',
  tabProfileOutline: 'person-outline',

  // Navigation
  back: 'chevron-back',
  forward: 'chevron-forward',
  close: 'close',

  // Actions
  check: 'checkmark-circle',
  checkOutline: 'checkmark-circle-outline',
  send: 'send',
  add: 'add',

  // Communication
  chat: 'chatbubble',
  chatOutline: 'chatbubble-outline',
  notifications: 'notifications-outline',
  call: 'call-outline',

  // Services
  cut: 'cut',
  cutOutline: 'cut-outline',
  star: 'star',
  starOutline: 'star-outline',

  // Misc
  settings: 'settings-outline',
  location: 'location-outline',
  time: 'time-outline',
  person: 'person-outline',
  gift: 'gift-outline',
  logOut: 'log-out-outline',
  image: 'image-outline',
  camera: 'camera-outline',
  trash: 'trash-outline',
  warning: 'warning-outline',
  information: 'information-circle-outline',
  grid: 'grid',
  gridOutline: 'grid-outline',
  people: 'people',
  peopleOutline: 'people-outline',
  colorWand: 'color-wand',
  colorWandOutline: 'color-wand-outline',
  ribbon: 'ribbon-outline',
  shield: 'shield-checkmark-outline',
  flash: 'flash-outline',
  heart: 'heart-outline',
  brush: 'brush-outline',
  arrowForward: 'arrow-forward',
  alertCircle: 'alert-circle-outline',
  mail: 'mail-outline',
  lock: 'lock-closed-outline',
  checkmark: 'checkmark',
  search: 'search-outline',
  refresh: 'refresh-outline',
  calendarClear: 'calendar-clear-outline',
  book: 'book-outline',
  arrowBack: 'arrow-back',
  ellipse: 'ellipse',
  ellipseOutline: 'ellipse-outline',
} as const;

// ==========================================
// TAB BAR CONFIG
// ==========================================
export const tabBar = {
  height: 70,
  paddingBottom: 12,
  backgroundColor: colors.surface,
  borderTopWidth: 1,
  borderTopColor: colors.border,
  indicatorWidth: 20,
  indicatorHeight: 3,
} as const;

// ==========================================
// BUTTON VARIANTS
// ==========================================
export const buttons = {
  primary: {
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  primaryText: {
    color: colors.background,
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  outlineText: {
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.md,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  ghostText: {
    color: colors.grey,
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
  },
} as const;

// ==========================================
// CARD STYLES
// ==========================================
export const cards = {
  default: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  elevated: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.md,
  },
  goldAccent: {
    borderTopWidth: 2,
    borderTopColor: colors.gold,
  },
  leftGoldAccent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
} as const;

// ==========================================
// STATUS BADGES
// ==========================================
export const statusBadges = {
  pending: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: colors.gold,
    color: colors.gold,
  },
  confirmed: {
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
    borderColor: colors.green,
    color: colors.green,
  },
  inProgress: {
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    borderColor: colors.blue,
    color: colors.blue,
  },
  completed: {
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
    borderColor: colors.green,
    color: colors.green,
  },
  cancelled: {
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
    borderColor: colors.red,
    color: colors.red,
  },
  declined: {
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
    borderColor: colors.red,
    color: colors.red,
  },
} as const;

// ==========================================
// LOYALTY STAMPS
// ==========================================
export const loyalty = {
  stampSize: 40,
  stampSpacing: 8,
  earnedBackground: colors.goldGlow,
  earnedBorder: colors.gold,
  earnedIconColor: colors.gold,
  emptyBackground: colors.surfaceRaised,
  emptyBorder: colors.border,
  emptyIconColor: colors.greyDark,
} as const;

// ==========================================
// ANIMATION CONFIG
// ==========================================
export const animations = {
  // Durations (ms)
  fast: 150,
  normal: 300,
  slow: 500,

  // Spring configs for Reanimated
  spring: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },

  // Scale values
  pressScale: 0.97,
  activeScale: 1.0,

  // Fade
  fadeIn: {
    from: 0,
    to: 1,
    duration: 300,
  },

  // Slide
  slideUp: {
    from: 20,
    to: 0,
    duration: 300,
  },
} as const;

// ==========================================
// UTILITY EXPORTS
// ==========================================
export const C = colors; // shorthand
export default {
  colors,
  fonts,
  spacing,
  radius,
  shadows,
  icons,
  tabBar,
  buttons,
  cards,
  statusBadges,
  loyalty,
  animations,
};
