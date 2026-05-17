// Timezone: +5:30 (IST - Indian Standard Time)
const IST_OFFSET = 5.5 * 60 * 60 * 1000; // in milliseconds

export function getISTTime(): Date {
  const now = new Date();
  const istTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + IST_OFFSET);
  return istTime;
}

export function getTimeGreeting(): string {
  const istTime = getISTTime();
  const hour = istTime.getHours();

  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  } else {
    return 'Good evening';
  }
}

export function formatISTDate(date: Date = new Date()): string {
  const istTime = getISTTime();
  return istTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}
