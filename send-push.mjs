// Sends the daily reminder to every subscription in subscriptions.json.
// Runs from GitHub Actions on UTC crons that bracket Sydney time; this
// script decides morning vs evening from actual Australia/Sydney clock
// so daylight-saving changes never break the schedule.
import webpush from 'web-push';
import { readFileSync } from 'fs';

const subs = JSON.parse(readFileSync('./subscriptions.json', 'utf8'));
if (!subs.length) { console.log('no subscriptions yet'); process.exit(0); }

const sydney = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', hour12: false });
const hour = Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', hour12: false }).format(new Date()));
console.log('Sydney time:', sydney, '— hour', hour);

const MORNING = [
  'Morning. Tap the pledge before the day gets loud.',
  'Day starts now. Pledge it, then go be a non-drinker.',
  'One tap. That’s the whole job right now.',
  'Clear head loading. Lock in the pledge.',
];
const EVENING = [
  'Scorecard time. Tick the day, name the win.',
  'Bank the day before bed — 2 minutes, done.',
  'How’d you go? The scorecard wants the truth.',
  'Close the loop: check in, plan tomorrow, lights out.',
];

let body, tag;
if (hour >= 5 && hour < 12) {
  const doy = Math.floor(Date.now() / 86400000);
  body = MORNING[doy % MORNING.length]; tag = 'morning';
} else if (hour >= 18 && hour < 23) {
  const doy = Math.floor(Date.now() / 86400000);
  body = EVENING[doy % EVENING.length]; tag = 'evening';
} else {
  console.log('outside reminder windows, skipping'); process.exit(0);
}

webpush.setVapidDetails('mailto:ryan@bondifoodtrailers.com.au',
  process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

const payload = JSON.stringify({ title: 'BEST RYAN', body, tag });
for (const sub of subs) {
  try {
    await webpush.sendNotification(sub, payload);
    console.log('sent', tag, 'to', sub.endpoint.slice(0, 40) + '…');
  } catch (e) {
    console.log('failed (' + e.statusCode + '):', sub.endpoint.slice(0, 40) + '…');
  }
}
