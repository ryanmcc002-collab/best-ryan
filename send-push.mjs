// Sends the daily reminders at exactly 6:00am / 8:30pm Ho Chi Minh time.
// GitHub cron starts us early (it runs late and sometimes drops runs), then
// this script sleeps until the precise target before sending. A later
// fallback cron re-runs it; the fallback checks whether an earlier run
// already handled the slot and skips if so.
import webpush from 'web-push';
import { readFileSync } from 'fs';

const subs = JSON.parse(readFileSync('./subscriptions.json', 'utf8'));
if (!subs.length) { console.log('no subscriptions yet'); process.exit(0); }

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

const now = new Date();
const utcH = now.getUTCHours();

function todayUTC(h, m) { const d = new Date(now); d.setUTCHours(h, m, 0, 0); return d; }

let slot = null, target = null;
if (process.env.FORCE_TEST === 'yes') {
  slot = 'test'; target = now;
} else if (utcH >= 21 && utcH <= 23) {          // morning window: 6:00am HCM = 23:00 UTC
  slot = 'morning'; target = todayUTC(23, 0);
} else if (utcH >= 12 && utcH <= 14) {          // evening window: 8:30pm HCM = 13:30 UTC
  slot = 'evening'; target = todayUTC(13, 30);
} else {
  console.log('outside reminder windows, skipping'); process.exit(0);
}

const isFallback = now.getTime() > target.getTime() + 60000;

// Fallback runs only fire if no earlier scheduled run handled this slot.
if (isFallback && slot !== 'test') {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs?event=schedule&per_page=10`,
      { headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: 'application/vnd.github+json' } });
    const j = await res.json();
    const cutoff = Date.now() - 110 * 60 * 1000;
    const handled = (j.workflow_runs || []).some(r =>
      String(r.id) !== process.env.GITHUB_RUN_ID &&
      new Date(r.created_at).getTime() > cutoff &&
      (r.status === 'in_progress' || r.conclusion === 'success'));
    if (handled) { console.log('primary run handled this slot — skipping fallback'); process.exit(0); }
    console.log('primary run missing — fallback sending now');
  } catch (e) { console.log('dedupe check failed, sending anyway:', e.message); }
}

// Sleep until the exact target time (public repo = free runner minutes).
const waitMs = target.getTime() - Date.now();
if (waitMs > 0) {
  console.log(`sleeping ${Math.round(waitMs / 60000)} min until exact send time…`);
  await new Promise(r => setTimeout(r, waitMs));
}

const doy = Math.floor(Date.now() / 86400000);
let body, tag;
if (slot === 'test') { body = 'Test: reminders are live and on time. No excuses left, mate.'; tag = 'test'; }
else if (slot === 'morning') { body = MORNING[doy % MORNING.length]; tag = 'morning'; }
else { body = EVENING[doy % EVENING.length]; tag = 'evening'; }

webpush.setVapidDetails('mailto:ryan@bondifoodtrailers.com.au',
  process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

const payload = JSON.stringify({ title: 'BEST RYAN', body, tag });
for (const sub of subs) {
  try {
    await webpush.sendNotification(sub, payload);
    console.log('sent', tag, 'at', new Date().toISOString());
  } catch (e) {
    console.log('failed (' + e.statusCode + '):', sub.endpoint.slice(0, 40) + '…');
  }
}
