# Getting Takhti onto an Android phone

For the prototype video you want it running **on the handset, full screen, with
no browser chrome, working in airplane mode**. That is a PWA, and it is already
built — you just need to serve it over https and install it.

There is no Android Studio, no APK build, and no Play Store in this path.

---

## Why https is not optional

Three things in this app refuse to run over plain `http://192.168.x.x`:

- **the microphone** — `getUserMedia` and speech recognition need a secure context
- **the camera** — same rule, so notebook photos won't work
- **the service worker** — which is the thing that makes airplane mode real

So "open my laptop's IP on my phone" does not work. Two paths that do.

---

## Path A — deploy to Vercel (recommended, ~5 minutes)

```bash
npm i -g vercel
cd takhti
vercel                              # accept defaults
vercel env add ANTHROPIC_API_KEY    # your key, all environments
vercel env add TAKHTI_MODEL         # optional; defaults to claude-sonnet-5
vercel --prod
```

You get an https URL. On the phone:

1. Open it in **Chrome** (not Samsung Internet, not the Instagram browser).
2. Wait ~5 seconds for the service worker to cache everything. The console
   logs `[takhti] offline ready` if you have USB debugging on.
3. Menu (⋮) → **Add to Home screen** → Install.
4. Close Chrome entirely. Launch Takhti from the home screen icon.

It now opens full screen with no address bar, its own icon, its own task in
the app switcher. It looks and behaves like a native app because for the
purposes of your video it is one.

**Then turn on airplane mode and open it again.** Everything works: the
lessons, the writing pad, the maths explainers, the daily card, the parent
dashboard. That is the demo.

## Path B — USB, no deployment (if you want to test right now)

Chrome's port forwarding maps your laptop's `localhost` onto the phone, and
the phone treats `localhost` as a secure origin — so the mic and the service
worker both work.

1. Phone: Settings → About → tap Build number 7 times → Developer options →
   **USB debugging** on. Plug in, accept the fingerprint prompt.
2. Laptop: `npm run dev` (still on port 5173).
3. Laptop Chrome: `chrome://inspect/#devices` → **Port forwarding** →
   add `5173` → `localhost:5173` → tick *Enable port forwarding*.
4. Phone Chrome: open `http://localhost:5173`.

Install to home screen the same way. Note the app stays reachable after you
unplug **only** because the service worker cached it — which is a nice thing
to notice, and also a good way to prove the caching actually worked.

---

## What to check on the phone before you record

- **Mic on the reading loop.** Android Chrome will ask for permission the
  first time; grant it before you start recording.
- **Hindi voice.** Settings → Accessibility → Text-to-speech → install the
  Hindi voice data if it is missing. The trace panel says
  `Hindi voice NOT installed` when it is absent — check that line first.
- **Camera** on the paper-writing mode fires the real camera app on Android.
  Have a notebook with a sentence already written in it, in good light.
- **Landscape.** The manifest pins portrait; if your phone forces landscape
  the layout still works but the phone frame looks odd on video.
- **Do Not Disturb on.** A WhatsApp banner across your hero moment is a
  miserable way to lose a take.

## If you later want a real .apk

Two options, neither needed for round 1:

- **PWABuilder** (`pwabuilder.com`) — paste the deployed URL, it generates a
  signed Android package wrapping this exact PWA. Twenty minutes.
- **Capacitor** — `npm i @capacitor/core @capacitor/cli && npx cap init &&
  npx cap add android`. Gives you a real Android Studio project, which is the
  right base if you go on to swap in the native on-device speech recognizer.

The Kotlin rewrite described in CLAUDE.md is the real destination. This PWA is
how you demo a convincing prototype without spending the 30 hours on it.
