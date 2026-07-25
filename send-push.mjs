// Sends the daily reminder to every subscription in subscriptions.json.
// Runs from GitHub Actions on UTC crons; this script decides morning vs
// evening from the actual Asia/Ho_Chi_Minh clock (UTC+7, no DST).
import webpush from 'web-push';
import { readFileSync } from 'fs';

const subs = JSON.parse(readFileSync('./subscriptions.json', 'utf8'));
if (!subs.length) { console.log('no subscriptions yet'); process.exit(0); }

const sydney = new Date().toLocaleString('en-AU', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
const hour = Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Asia/Ho_Chi_Minh', hour: 'numeric', hour12: false }).format(new Date()));
console.log('Ho Chi Minh time:', sydney, '— hour', hour);

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
  'Write tomorrow’s list before bed — future you wakes up with orders.',
];

let body, tag;
if (process.env.FORCE_TEST === 'yes') {
  body = 'Reminders are live. 7am pledge, 8:30pm check-in. No excuses left, mate.'; tag = 'test';
} else if (hour >= 5 && hour < 12) {
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
