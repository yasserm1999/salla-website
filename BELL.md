# Ring the Bell

A customer waiting outside opens **sallalaundry.com/bell**, presses one button, and the
screen inside the shop rings until somebody says they are coming.

## The pages

| Page | Who | What it does |
| --- | --- | --- |
| `/bell` · `/ar/bell` | anyone, no login | One round RING button, an optional customer ID or phone box, and a confirmation dialog. After ringing it shows "Ringing… we're on our way", then "Sonu is coming out" once the bell is answered. |
| `/bell/staff` | signed-in staff | Rings out loud, shows who is outside, what is ready and on which rack, and a big COMING button. |

The bell link sits in the site navigation (desktop and mobile), in both languages.

## Who gets the alert

`BELL_STAFF` — usernames from `ADMIN_USERS`, comma separated. Set to `sonu`.
Owners can always open the staff page as well, so a ring is never left unwatched.
Nothing else changes: the bell uses the existing admin login.

## Setting up an iPad (Safari)

Apple allows alerts only from a Home Screen app, never from a Safari tab, so the order
matters:

1. Open **sallalaundry.com/bell/staff** in Safari and sign in as `sonu`.
2. Tap the **Share** button (the square with an arrow) → **Add to Home Screen** → **Add**.
3. Close Safari. Open **Salla bell** from the Home Screen.
4. Tap **Turn on alerts** and allow notifications.
5. Tap **Enable sound** once, and turn the iPad's ringer and media volume up.

Needs iPadOS 16.4 or newer. In a Safari tab the alerts button reads "Add to Home Screen
first" and the page shows these steps; the page still rings on its own while it is open
with sound enabled.

## Setting up an Android tablet

1. Open **sallalaundry.com/bell/staff** in Chrome and sign in as `sonu`.
2. Tap **Enable sound** once. Browsers refuse to make noise until the page has been
   touched, so this tap is what lets the bell ring later. The button turns green.
3. Tap **Turn on alerts** and allow notifications. This is what wakes the tablet when
   the page is in the background.
4. Install it: Chrome menu (⋮) → **Add to Home screen**. It opens full screen from the
   home screen afterwards, like an app.
5. In Android **Settings → Display**, set the screen timeout long, or leave the tablet
   on its charger with "stay awake" on. Push alerts still arrive if it sleeps.

Do the same on his phone if he wants it in his pocket — each device subscribes
separately, and both will ring.

## What the alert shows

- The customer's name, or the number they typed if we do not recognise it.
- **Ready to collect** — each order with its rack number, pieces, and days on the rack.
- **Still being washed** — order number, pieces and when it is due.
- "No active orders" when they have none, "Customer not found" when the number matches
  nobody. Either way the bell still rings.

Order details never appear on the public page. The customer only ever sees that the
bell rang and that somebody is coming.

## Rules

- While a ring is unanswered, the same device is held to one ring every **2 minutes**:
  pressing again shows "Bell already rung — we're coming" and keeps watching the first
  ring, so the tablet is not buzzed five times for one car.
- Once somebody taps COMING that ring is finished, and the customer may ring again
  straight away — being told help is coming and then waiting is exactly when the bell
  is needed a second time.
- At most **5 rings per address every 10 minutes** (`BELL_IP_LIMIT`, default 5).
- Every ring is logged in `salla_bell_rings`: when it rang, whether a customer was
  matched, who answered and when — so response times can be reviewed later.

## Settings

See `.env.bell.example`. Beyond the site's existing keys:

```
BELL_STAFF=sonu
VAPID_PUBLIC_KEY=…
VAPID_PRIVATE_KEY=…
VAPID_SUBJECT=mailto:info@sallalaundry.com
BELL_IP_LIMIT=5          # optional
PENDING_PAYMENT_RACK=200 # optional, already used elsewhere on the site
```

New push keys, if they are ever needed: `npx web-push generate-vapid-keys`.
Changing them logs every device out of alerts; each would tap "Turn on alerts" again.

## Tables

`supabase/bell.sql` — `salla_bell_rings` (the log) and `salla_bell_devices` (which
browsers to buzz). Both already exist in Supabase.
