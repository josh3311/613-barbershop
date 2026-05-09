export const APP = {
    name:          '613 Barbershop',
    bundleId:      'com.barbershop613.app',
    supportEmail:  'support@613barbershop.com',
  
    booking: {
      maxDaysAhead:     30,    // clients can book up to 30 days out
      cancellationHrs:  2,     // must cancel 2hrs before appointment
      slotDurationMin:  30,    // calendar slots every 30 minutes
    },
  
    loyalty: {
      stampsForReward:  10,    // 10 cuts = 1 free cut
    },
  
    ai: {
      maxImageSizeMB:   5,
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  } as const;