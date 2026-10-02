# Neon Trails

A fast neon light-cycle party game for Android and the web.

- **Party Mode (offline):** 2–4 friends play on one phone or tablet. Each player gets their own ◀ ▶ buttons in a corner of the screen. Bots can fill empty seats. No internet needed.
- **Online:** use **Quick Match** to join a game with bots filling empty seats, or create a **private room** and share its 4-letter code with friends.

Your ride never stops moving. Steer left and right, and don't hit a wall or any trail, including your own. Trails have gaps you can slip through. Each time someone crashes, every survivor scores a point. The first player to reach the target score with a 2-point lead wins.

Power-ups: **Boost**, **Ghost** (pass through trails), **Freeze** (slows your rivals), **Fatten** (rivals leave thick trails), **Reverse** (flips your rivals' controls), **Portal** (walls wrap around), **Wipe** (clears the board).

### What keeps players coming back
- Rounds last 20–40 seconds, so there's always time for "one more round".
- Easy to learn: just two buttons.
- XP, levels and win streaks are saved on the device, and you get a level-up reward after matches.
- The menu runs a live bot match in the background.
- Big moments feel good: screen shake, explosions, flashes, vibration and a synthwave soundtrack.

## Project layout

```
client/            The game. Plain HTML5 Canvas + ES modules, no build step.
  shared/game.js   Game simulation, shared by offline play and the server.
  js/render.js     Neon renderer: bloom glow, particles, screen shake.
  js/main.js       Menus, game loop, online client.
  config.js        Online server address (set this before publishing!).
server/server.js   Online server: rooms, quick match, runs the matches (60 ticks/s).
android/           Capacitor Android project (opens in Android Studio).
store/             Google Play icon (512×512) and feature graphic (1024×500).
tools/             Icon/splash generator.
test/              Engine soak test, server protocol test, browser smoke test.
```

## Run it locally

```bash
cd neon-trails
npm install
npm start            # http://localhost:8080 serves the game and the online server
npm test             # engine + online server tests
```

Open http://localhost:8080 in two browser windows to try online play against yourself.
Keyboard controls: P1 `A/D`, P2 `←/→`, P3 `J/L`, P4 `4/6`. Press `Esc` to pause.

## Put the online server on the internet

You need any host that supports WebSockets. The included `Dockerfile` works on most of them. For example, with **Google Cloud Run**:

```bash
gcloud run deploy neon-trails --source . --region asia-south1 --allow-unauthenticated \
  --session-affinity --min-instances 1 --max-instances 1 --timeout 3600
```

Keep it to **one instance**: rooms are stored in memory, so players in the same room must be on the same server. Render, Railway and Fly.io also work (`npm start`, port taken from `$PORT`).

Then put the server address in `client/config.js`:

```js
export const SERVER_URL = 'wss://neon-trails-xxxxx.a.run.app/ws';
```

The deployed server also hosts a playable web version at its URL. It can be installed as a PWA and works offline.

## Publish on Google Play

1. Install **Android Studio** (it includes the Android SDK and JDK).
2. Sync the game into the Android project and open it:
   ```bash
   npx cap sync android
   npx cap open android
   ```
3. Change the package name if you want your own: `appId` in `capacitor.config.json` and `applicationId` in `android/app/build.gradle`, for example `com.yourname.neontrails`. **It can't be changed after you publish.**
4. Raise `versionCode` / `versionName` in `android/app/build.gradle` for every release.
5. Android Studio: **Build → Generate Signed App Bundle → Android App Bundle**. Create an upload keystore. Back it up, and never commit it.
6. In the [Google Play Console](https://play.google.com/console) (one-time $25 developer fee):
   - Create the app → *Game* → *Free*.
   - Upload the `.aab` to **Internal testing** first, and test on real phones.
   - Store listing: use `store/play-icon-512.png` and `store/feature-graphic-1024x500.png`, plus 2–8 landscape screenshots taken in the game.
   - Fill in Content rating (cartoon-style, no violence against people), Data safety (the game collects no personal data; the online name is only sent to your game server), Target audience, and a privacy policy URL.
   - New personal developer accounts must run a **closed test with at least 12 testers for 14 days** before they can publish to Production.

The Android app is already set up to lock to landscape, run full-screen, keep the screen on, and use the neon icon and splash screen. Re-run `npm run icons` if you change `client/icons/icon.svg`.

## Ideas for later
- Unlockable trail colours and cosmetics tied to levels.
- Google Play Games sign-in, leaderboards and achievements.
- Daily challenges (for example, "survive 60 s against 3 bots").
- Wi-Fi LAN play between nearby phones.
