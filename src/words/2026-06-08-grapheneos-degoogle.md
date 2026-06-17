---
layout: layouts/post.njk
title: From Google to Graphene
subtitle: A Straightforward Guide to De-Google Your Pixel
date: 2026-06-08
permalink: "/words/{{ page.fileSlug }}/"
extraCSS: ["/assets/css/words-post.css"]
extraJS: ["/assets/js/words-post.js"]
---

<!-- INTRO PLACEHOLDER (lorem ipsum). Replace with the author's real intro before publish. -->

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

<div class="dgw-callout dgw-callout--disclosure">

> This guide was drafted by Claude Opus 4.8 running in Claude Code, during and after an actual Pixel 9 Pro migration to GrapheneOS rather than as a theoretical writeup. Commands, version numbers, and behavior notes reflect what the install looked like on the day of writing. Verify every step against primary sources (the GrapheneOS install page, the F-Droid project, and each app's own documentation) before running anything on your own device, because Android sideloading policy, Play Integrity behavior, and GrapheneOS releases all shift on short timelines.

</div>

<nav class="post-toc" aria-label="Contents">
<h2>Contents</h2>
<ol>
  <li><a href="#two-paths">Two Paths: Partial Or Full</a></li>
  <li><a href="#back-up-the-old-phone">Back Up The Old Phone</a></li>
  <li><a href="#flash-grapheneos">Flash GrapheneOS</a></li>
  <li><a href="#harden-the-new-install">Harden The New Install</a></li>
  <li><a href="#app-install-sources">App Install Sources</a></li>
  <li><a href="#restore-data">Restore Data</a></li>
  <li><a href="#fix-google-contacts-and-calendar-sync-with-davx5">Fix Google Contacts And Calendar Sync With DAVx5</a></li>
  <li><a href="#browsers">Browsers</a></li>
  <li><a href="#google-service-alternatives">Google Service Alternatives</a></li>
  <li><a href="#full-degoogle-replacing-gmail-calendar-drive">[Full De-Google] Replacing Gmail, Calendar, and Drive</a></li>
  <li><a href="#common-pitfalls">Common Pitfalls</a></li>
  <li><a href="#next-steps">Next Steps</a></li>
</ol>
</nav>

<section id="two-paths">
<h2>◆ Two Paths: Partial Or Full ◆</h2>

This guide supports two endpoints. Pick whichever fits the available time and tolerance for change. The partial path is the weekend project. The full path is the multi-week migration.

### What each path covers

| Layer | Partial de-Google | Full de-Google |
|---|---|---|
| Phone OS | GrapheneOS | GrapheneOS |
| Photos | Ente | Ente |
| SMS/MMS | Fossify Messages | Fossify Messages |
| Password manager | Bitwarden or Proton Pass | Bitwarden or Proton Pass |
| 2FA | Proton Authenticator or Aegis | Proton Authenticator or Aegis |
| VPN | Proton VPN or Mullvad | Proton VPN or Mullvad |
| Search | DuckDuckGo, Kagi, or Brave Search | DuckDuckGo, Kagi, or Brave Search |
| Browser | Vanadium + IronFox | Vanadium + IronFox |
| Maps | Organic Maps for offline, Google Maps when needed | Organic Maps, Magic Earth |
| YouTube viewing | NewPipe or LibreTube | NewPipe or LibreTube |
| Mail | Gmail (kept) | Proton Mail + SimpleLogin or Addy.io aliases |
| Calendar | Google Calendar via DAVx5 | Proton Calendar via DAVx5 |
| Contacts | Google Contacts via DAVx5 | Proton Contacts or local vCard |
| Cloud storage | Google Drive (kept) | Proton Drive |

### Start partial, tighten later

Most steps in this guide apply to both paths. Sections that only apply to the full path are tagged with `[Full de-Google]` in the heading. Skip those on a first pass and return to them later. Nothing about the partial path blocks an upgrade to the full path. The OS, app inventory, and sync stack stay the same. Only the account behind mail, calendar, and drive changes.

A reasonable order: ship the partial path first, live on it for two or three weeks, then migrate mail last once the rest of the device is stable.

<details class="dgw-why"><summary>Why this matters</summary>

The partial path is a defensible starting point. It removes the largest privacy liabilities (the OS itself, photos, messages, browser, search, and ambient location) in a single weekend, without forcing a mail migration that touches every account ever signed up for. Friction kills follow-through, and a half-finished migration that leaves the phone in a broken state usually gets rolled back. Shipping a working partial setup first preserves momentum and still cuts a meaningful amount of passive data collection.

The full path is worth considering because concentrated data is a single-point-of-disclosure risk. A mail account is the root of the password-reset tree for nearly every other account, so whoever reads the inbox can eventually reach most of the rest. Replacing Gmail with Proton Mail and routing signups through SimpleLogin or Addy.io aliases is the single largest de-Google move available, both because it severs the inbox from ad profiling and because aliases let future leaks be contained and rotated without changing the underlying address.

</details>
</section>

<aside class="dgw-decision-tree" data-widget="decision-tree" aria-label="Partial vs Full decision tree"></aside>

<section id="back-up-the-old-phone">
<h2>◆ Back Up The Old Phone ◆</h2>

Flashing GrapheneOS wipes the device. Plan the backup before touching the installer, because most of what lives on an Android phone cannot be recovered from a Google account alone.

### Inventory first

Before pulling anything, inventory what is on the device. With the phone plugged in and USB debugging enabled, run:

```
adb shell pm list packages -3
adb shell du -sk /sdcard/* | sort -n
```

The first command lists every third-party app (anything not preinstalled). The second prints the size of each top-level folder under user storage so the heavy hitters are obvious. Save both outputs to a text file. They double as the install checklist for the new phone.

### Pull user storage to an external drive

Everything under `/sdcard` is user-accessible and worth pulling. The folders that matter most:

- `Documents`
- `DCIM` (camera roll)
- `Pictures` (screenshots and app-saved images)
- `Movies`
- `Download`
- `Android/media/com.whatsapp` (WhatsApp's local message and media store)

Mount an external drive and pull each folder in turn:

```
adb pull /sdcard/DCIM/ /Volumes/Backup/pixel-prewipe/DCIM/
adb pull /sdcard/Documents/ /Volumes/Backup/pixel-prewipe/Documents/
adb pull /sdcard/Android/media/com.whatsapp/ /Volumes/Backup/pixel-prewipe/whatsapp/
```

Large folders can take an hour or more. Do not let the Mac sleep during the transfer.

<details>
<summary>macOS pitfall: external drive permissions</summary>

Granting Terminal (or whichever app is running `adb`) "Full Disk Access" in <span class="settings-path">System Settings<span class="settings-path-sep">→</span>Privacy and Security</span> is more reliable than toggling <span class="settings-path">Files and Folders<span class="settings-path-sep">→</span>Removable Volumes</span>. Long `adb pull` sessions writing to an external drive will silently stall or fail on permission prompts otherwise.
</details>

### App data that adb cannot reach

Most app data lives under `/data/data/<package>/`, which is sandboxed and unreadable without root. Banking apps, Signal, authenticator apps, password managers, and anything else with sensitive state will not come along in an `adb pull`. Each one needs its own export flow before the wipe.

### WhatsApp

<ol class="steps">
<li>Open WhatsApp.</li>
<li>Go to <span class="settings-path">Settings<span class="settings-path-sep">→</span>Chats<span class="settings-path-sep">→</span>Chat Backup</span>.</li>
<li>Tap "Back Up Now". This refreshes <code>msgstore.db.crypt14</code> inside <code>/sdcard/Android/media/com.whatsapp/</code>.</li>
<li>Run the <code>adb pull</code> of that folder so the captured database is current.</li>
</ol>

If end-to-end encrypted backup is enabled, write down the 64-character encryption key. Without it the restored database cannot be opened, even with the correct file in place.

### Signal

Signal Secure Backups (the paid cloud option) is the cleanest restore path. Enable it, then save the recovery key on paper. The free local-backup option exists but the restore flow is brittle and the key is just as critical.

### 2FA recovery codes

Recovery codes for every account with TOTP need to exist on paper before the wipe. At minimum:

- Bitwarden
- Proton (account-level codes, separate from Proton Mail login)
- Microsoft Authenticator (if used for work accounts)
- Any TOTP app holding seeds that are not backed up elsewhere

Without these codes, locked-out accounts may be unrecoverable. Print them. Do not screenshot them to a cloud-synced photo library.

### Crypto wallets

Seed phrases belong on paper or a metal backup plate. Screenshots end up in cloud photo backups, OCR indexes, and clipboard history. Verify the seed by restoring to a throwaway wallet before wiping the source device.

### Pre-deregister Cash App and Venmo

Log into each service's web dashboard and remove the old device from the trusted-devices list. Reinstalling on a freshly flashed phone otherwise looks like account takeover and triggers a fraud hold that can take days to clear.

### Final check

Before starting the flash, confirm the external drive has: user storage folders, the refreshed WhatsApp folder, the WhatsApp encryption key, the Signal recovery key, printed 2FA codes, and crypto seeds. Anything missing from that list is gone after the bootloader unlock.

<details class="dgw-why"><summary>Why this matters</summary>

Android keeps two very different kinds of data. User storage under `/sdcard` (photos, downloads, documents, a handful of app-exposed folders) is pullable over `adb` with no special access. App-private storage under `/data/data/<package>/` is sandboxed by the OS and unreadable without root, which is the same isolation that protects an app's secrets from every other app on the device. That isolation is a security feature on a running phone and a backup problem at wipe time. The only way out is each app's own export flow.

Recovery codes belong on paper because the failure mode they exist for is "the device holding the TOTP seeds is gone". Storing them in a cloud-synced note, a screenshot in a photo library, or another app on the same phone defeats the purpose. A printed sheet in a drawer survives a lost, broken, stolen, or freshly wiped device.

WhatsApp's local backup is fragile (a single file plus a 64-character key, no integrity guarantees, no version history) but it is the only restore path that does not route message history through Google Drive. For anyone moving to an OS without Google account sync, the local-file path is the only option. Refreshing the backup immediately before the final pull is the difference between restoring last night's messages and restoring last month's.

</details>
</section>

<section id="flash-grapheneos">
<h2>◆ Flash GrapheneOS ◆</h2>

The official [web installer](https://grapheneos.org/install/web) handles the entire flash from a browser. It is the recommended path for the Pixel 9 Pro and avoids the manual fastboot dance.

### Pre-flight

Confirm each item before plugging anything in:

- Install Chrome or Edge on the Mac. WebUSB does not work in Firefox, Safari, or any other Gecko or WebKit browser.
- Pixel battery at 50% or higher.
- At least 32 GB free on the Mac.
- Remove the Google account from the phone first (<span class="settings-path">Settings<span class="settings-path-sep">→</span>Passwords and accounts</span>). This avoids Factory Reset Protection complications after the wipe.
- Use a USB-C data cable directly into a Mac USB-C port. No hubs, no dongles, no adapters.

### Enable OEM unlocking

On the phone:

<ol class="steps">
<li>Open <span class="settings-path">Settings<span class="settings-path-sep">→</span>About phone</span> and tap Build number seven times to unlock Developer options.</li>
<li>Go to <span class="settings-path">Settings<span class="settings-path-sep">→</span>System<span class="settings-path-sep">→</span>Developer options</span>.</li>
<li>Toggle OEM unlocking on.</li>
<li>Power the phone off completely.</li>
</ol>

### Boot into fastboot

Hold Volume Down and Power together until the red warning triangle appears with "Fastboot Mode" text below it. Release both buttons.

### Run the web installer

<ol class="steps">
<li>Plug the phone into the Mac.</li>
<li>Open <a href="https://grapheneos.org/install/web">https://grapheneos.org/install/web</a> in Chrome or Edge.</li>
<li>Click "Unlock bootloader". Confirm the prompt on the device with the volume keys and power button. The phone wipes at this step.</li>
<li>Click "Download release" and wait for the factory image to download.</li>
<li>Click "Flash release". The flash takes several minutes. Do not touch the phone, unplug the cable, or close the browser tab during this step.</li>
<li>When flashing finishes, the installer prompts to return to bootloader mode. Follow the on-screen instructions.</li>
<li>Click "Lock bootloader". This wipes the device a second time and enables verified boot. This step is required.</li>
</ol>

### Verify the boot key hash

On first boot after locking, the phone briefly displays a yellow warning screen with the boot key fingerprint. For the Pixel 9 Pro, the expected hash is:

```
f729cab861da1b83fdfab402fc9480758f2ae78ee0b61c1f2137dd1ab7076e86
```

This value is published on the GrapheneOS [install page](https://grapheneos.org/install/web) under the device list. If the displayed hash does not match exactly, stop. Do not complete setup. Ask in the GrapheneOS chat before proceeding.

### First-run setup

In the setup wizard:

- Set a strong alphanumeric password. Avoid PIN-only unlock; PINs are weak against forensic extraction.
- On the final screen, disable OEM Unlocking. This prevents a future attacker (or a lost-phone scenario) from re-unlocking the bootloader without first wiping the device.

<details>
<summary>About eSIMs</summary>

The eSIM profile lives on the eUICC chip, which is separate hardware from the user-data partition that gets wiped during flashing. The eSIM almost always survives a factory reset and the GrapheneOS install.

Carriers like US Mobile typically reactivate the line after one reboot on the freshly flashed device. No carrier call required. There is no need to pre-emptively request a replacement eSIM unless the carrier confirms the old profile is dead after the install completes.

If the eSIM does not come back after a reboot or two, contact the carrier and request a new eSIM activation QR code. Most carriers issue one within minutes.

</details>

<details>
<summary>If the installer fails mid-flash</summary>

Unplug the cable, hold Power for 10 seconds to force a reboot back into fastboot mode, then restart the browser tab and try "Flash release" again. The installer is idempotent: a failed flash leaves the device in fastboot, not bricked.

</details>

<details class="dgw-why"><summary>Why this matters</summary>

Verified boot is the cryptographic check that runs every time the phone powers on. The bootloader hashes the OS partition and compares that hash against a signature baked into the boot key. If a single byte of the OS has been modified (by malware, by a physical attacker with brief device access, by a tampered firmware update), the check fails and the phone refuses to boot the modified image. Without verified boot, a tampered OS could silently exfiltrate everything: keys, messages, location history, banking credentials. The boot key hash printed on first boot is the public anchor that lets a human confirm the running OS is the GrapheneOS build it claims to be, not a malicious lookalike.

Re-locking the bootloader after the flash is what turns verified boot back on. An unlocked bootloader will run any signed or unsigned image without complaint, which defeats the entire chain. Locking the bootloader is also why the OEM Unlocking toggle gets disabled in the setup wizard: an attacker with physical access and the unlock pathway open can re-flash the device without the user's password.

GrapheneOS clears a security bar that most "degoogled" Android ROMs do not. [Privacy Guides](https://privacyguides.org/en/android/) frames the criterion plainly: a custom Android distribution should preserve verified boot, rollback protection, and enforced SELinux. LineageOS and most community ROMs ship with an unlocked bootloader by design and cannot re-lock it, so verified boot is effectively off. GrapheneOS additionally ships a [hardened memory allocator](https://grapheneos.org/features) with zero-on-free and write-after-free detection, stricter app sandboxing, and a [sandboxed Google Play compatibility layer](https://grapheneos.org/faq) that runs Play services as an ordinary unprivileged app rather than as a privileged system component. Those are the upgrades over stock Pixel Android, not just the removal of Google.

</details>
</section>

<section id="harden-the-new-install">
<h2>◆ Harden The New Install ◆</h2>

GrapheneOS is already hardened out of the box, with a [hardened memory allocator and other exploit mitigations](https://grapheneos.org/features) enabled by default. The settings below layer on additional reductions in attack surface and forensic exposure. Walk through them once, in order, before restoring any apps or accounts.

### Settings checklist

<ol class="steps">
<li><strong>System update first.</strong> <span class="settings-path">Settings<span class="settings-path-sep">→</span>System<span class="settings-path-sep">→</span>System update</span>. Pull the latest build before doing anything else. Reboot when prompted.</li>

<li><strong>Auto reboot: 18 hours.</strong> <span class="settings-path">Settings<span class="settings-path-sep">→</span>Security &amp; privacy<span class="settings-path-sep">→</span>Device unlock<span class="settings-path-sep">→</span>Auto reboot</span>. If the device sits idle and locked for this long, it reboots back into the Before-First-Unlock state, where disk encryption keys are not in memory.</li>

<li><strong>USB-C port control: Charging-only when locked.</strong> <span class="settings-path">Settings<span class="settings-path-sep">→</span>Security &amp; privacy<span class="settings-path-sep">→</span>Device unlock<span class="settings-path-sep">→</span>USB-C port</span>. This is the default on GrapheneOS; confirm it is still set. Data lines are disabled whenever the screen is locked, which blocks accessory-based data extraction.</li>

<li><strong>Show Lockdown option.</strong> Go to <span class="settings-path">Settings<span class="settings-path-sep">→</span>Display &amp; touch<span class="settings-path-sep">→</span>Lock screen</span> and toggle on "Show lockdown option". Then long-press the power button (or pull down Quick Settings) and add the Lockdown tile. Triggering Lockdown disables fingerprint and face unlock and hides notifications until the passcode is entered.</li>

<li><strong>Camera EXIF location off.</strong> Open the Camera app, tap the gear icon, and disable "Save location". Photos taken afterward will not embed GPS coordinates in their EXIF metadata.</li>

<li><strong>LTE-only mode (optional).</strong> Open <span class="settings-path">Settings<span class="settings-path-sep">→</span>Network &amp; internet<span class="settings-path-sep">→</span>SIMs</span>, tap the active SIM, then set <span class="settings-path">Preferred network type<span class="settings-path-sep">→</span>LTE only</span>. This disables 2G fallback (where most IMSI catchers operate) and 5G geolocation features. Some readers want full 5G for speed; this is a tradeoff, not a requirement.</li>

<li><strong>Sensors permission default-off.</strong> <span class="settings-path">Settings<span class="settings-path-sep">→</span>Security &amp; privacy<span class="settings-path-sep">→</span>More security &amp; privacy<span class="settings-path-sep">→</span>Sensors</span>. With this enabled, apps must explicitly request access to the accelerometer, gyroscope, barometer, and similar sensors. This defeats a class of motion-based fingerprinting techniques.</li>

<li><strong>Duress password (optional, advanced).</strong> <span class="settings-path">Settings<span class="settings-path-sep">→</span>Security &amp; privacy<span class="settings-path-sep">→</span>Device unlock<span class="settings-path-sep">→</span>Duress password</span>. Entering this password at the lock screen irreversibly wipes the device, including the eSIM profile. Set this only with a clear plan. Accidental entry means total, unrecoverable data loss.</li>

<li><strong>Verify MAC randomization.</strong> Open <span class="settings-path">Settings<span class="settings-path-sep">→</span>Network &amp; internet<span class="settings-path-sep">→</span>Internet</span>, tap a connected Wi-Fi network, then open Privacy. Confirm it reads "Use randomized MAC" (per-connection). This is the default and should not need changing, but verify it on the home and work networks before anything else connects.</li>
</ol>

<div class="dgw-callout dgw-callout--warn"><strong>Reboot after this pass.</strong> Several of these settings (Auto reboot, Sensors, USB-C control) only take full effect after a reboot. Reboot once before moving on to app restore.</div>

Take a few minutes to scroll through the rest of <span class="settings-path">Settings<span class="settings-path-sep">→</span>Security &amp; privacy</span> as well. GrapheneOS exposes far more granular controls than stock Android, and many of them are worth knowing about even if their defaults are already sensible.

<details class="dgw-why"><summary>Why this matters</summary>

Hardening is defense in depth. No single setting prevents a determined attacker on its own, but each one removes a category of low-effort attack: cabled data extraction, passive sensor fingerprinting, downgrade to 2G, EXIF leakage in shared photos. The aggregate effect is a much smaller exposed surface than stock Android, and the per-setting cost is usually a one-time toggle.

The most important concept here is the difference between Before-First-Unlock (BFU) and After-First-Unlock (AFU). After a reboot, before the passcode is entered for the first time, disk encryption keys are not present in memory and most user data is genuinely inaccessible. Once the passcode is entered, keys are loaded and the device enters AFU, where a much broader set of data is recoverable from a running or recently-running device. Auto reboot returns an idle device to BFU on a timer; Lockdown lets the user force a state closer to BFU on demand.

Sensors-off, MAC randomization, LTE-only, and EXIF-off are all surface-area reductions in a different direction: they limit what an app, a network observer, or a recipient of a shared file can passively learn about the device and its owner. None are silver bullets. Together they meaningfully shrink the passive-collection footprint of a modern smartphone, which is the realistic threat for most users most of the time.

</details>
</section>

<section id="app-install-sources">
<h2>◆ App Install Sources ◆</h2>

GrapheneOS ships with no app stores preinstalled. Pick install sources deliberately, in this order: Sandboxed Google Play (for the apps that demand it), F-Droid (for FOSS), Obtainium (for GitHub releases). Skip Aurora Store.

### Sandboxed Google Play

<ol class="steps">
<li>Open the preinstalled <span class="settings-path">Apps<span class="settings-path-sep">→</span>GrapheneOS apps</span>.</li>
<li>Install "Google Play services". That single action installs three packages together: Google Play services, Google Services Framework, and Google Play Store.</li>
<li>Reboot when prompted.</li>
</ol>

On GrapheneOS these run as ordinary user apps. Per the [GrapheneOS usage docs](https://grapheneos.org/usage): "Google Play receives absolutely no special access or privileges on GrapheneOS as opposed to bypassing the app sandbox." The [FAQ](https://grapheneos.org/faq) reinforces this: GrapheneOS includes a "compatibility layer for sandboxed Play services to make user installed Play services apps able to run as fully sandboxed, unprivileged apps."

Sandboxed Google Play is required for:

- WhatsApp push notifications (without it, messages only arrive when the app is opened)
- Most banking apps (Play Integrity attestation)
- Carrier apps (US Mobile, T-Mobile, Verizon companion apps)
- Most rideshare, delivery, and airline apps

### Sign in to Google Play Store, not Aurora Store

GrapheneOS explicitly recommends Google Play Store over Aurora Store. Aurora's "anonymous" shared-account mode gets rate-limited, has a history of credential leaks, and offers no real privacy improvement once Sandboxed Google Play is installed: Play Integrity sees the device the same way regardless of which frontend installed the APK.

About the Google account prompt: the account is scoped to the Sandboxed Google Play instance inside the current user profile. It is not a system account. Other apps cannot enumerate it, and removing the profile removes the account along with all Play data. Use a dedicated Google account for the Play Store and keep the primary Google identity (if any) inside a separate profile or out of the device entirely.

### F-Droid

<ol class="steps">
<li>Open Vanadium.</li>
<li>Go to <a href="https://f-droid.org">f-droid.org</a>.</li>
<li>Tap "Download F-Droid" and install the APK.</li>
<li>When Vanadium requests install-from-unknown-sources permission, grant it for Vanadium only.</li>
</ol>

F-Droid is the source for FOSS apps that are not on Play: Tor Browser, NewPipe, IronFox, Organic Maps, DAVx5, Fossify Messages, and Obtainium itself. Updates are signed by F-Droid's build infrastructure with reproducible-build verification for many packages.

After install, copy the F-Droid APK and any critical FOSS APKs (IronFox, NewPipe, DAVx5, Organic Maps, Obtainium) to an external drive. See the next subsection for why.

### The September 2026 problem

In August 2025, Google announced that all apps installed on certified Android devices must come from Google-registered developers (government ID, registration fee, signing-key disclosure). The campaign site [keepandroidopen.org](https://keepandroidopen.org) tracks the rollout. F-Droid responded with a [position post](https://f-droid.org/2025/09/29/google-developer-registration-decree.html) calling it existential: "We believe it is about consolidating power and tightening control over a formerly open ecosystem."

GrapheneOS is uncertified by design and is likely exempt from the verification check, but the project has not publicly committed to stripping the check if Google ships it inside AOSP. Hedge by installing F-Droid now and cold-storing the APKs. Worst case, manual sideloading from the external drive still works.

### Obtainium

Some apps ship only as GitHub releases (Bitwarden beta channels, some Proton betas, niche FOSS tools). Install Obtainium directly from [github.com/ImranR98/Obtainium/releases/latest](https://github.com/ImranR98/Obtainium/releases/latest). Obtainium watches GitHub release feeds and prompts for updates. The same September 2026 caveat applies.

### Summary table

| Source | Use for | Where to get | September 2026 risk |
| --- | --- | --- | --- |
| Google Play Store | WhatsApp, banking, carrier, rideshare, mainstream apps | GrapheneOS Apps repo (Sandboxed Google Play bundle) | None. Google's own store. |
| F-Droid | Tor Browser, NewPipe, IronFox, Organic Maps, DAVx5, Fossify, Obtainium | f-droid.org via Vanadium | High. Cold-store APKs now. |
| Obtainium | GitHub-released apps not on Play or F-Droid | github.com/ImranR98/Obtainium | High. Same Google policy. |
| Aurora Store | Skip. No privacy gain over Play once Sandboxed Google Play is installed. | n/a | n/a |

<details class="dgw-why"><summary>Why this matters</summary>

Sandboxing matters even when Google Play is installed. On stock Android, Play services runs as a privileged system component with access far beyond what any normal app gets. On GrapheneOS, the same code runs inside the standard app sandbox with no special permissions. It can still phone home (that is what it does), but it cannot reach into other apps, read arbitrary files, or silently grant itself capabilities. The tradeoff is honest: some Play features that depend on privileged hooks (Wallet tap-to-pay, certain device-admin flows) do not work.

F-Droid beats sideloading random APKs from the web because the build pipeline is auditable. F-Droid builds from source on its own infrastructure, signs the result with its own key, and publishes reproducible-build status for many packages. A website-hosted APK has none of that: trust collapses to "did the host site get compromised today". Update notifications also matter: F-Droid pushes signed updates, while a random APK becomes stale and vulnerable the moment a CVE drops.

The sideloading restrictions coming in late 2026 are framed as a security measure, and registration plus signing-key disclosure do raise the bar for casual malware authors. The same mechanism also gives Google a chokepoint over which developers can ship to Android at all, including FOSS maintainers who do not want to attach a government ID to their packages. Both framings are true at the same time. The relevant question is who decides which apps a device owner can install, and the answer under the new policy shifts toward Google.

If F-Droid loses its ability to distribute updates on certified devices, GrapheneOS users have two fallbacks: F-Droid may continue to function on uncertified devices like GrapheneOS, or manual sideloading from cold-stored APKs remains available. Neither is as good as a working repo with signed updates. Installing F-Droid and archiving the current APK set today preserves optionality regardless of how the policy rolls out.

</details>
</section>

<section id="restore-data">
<h2>◆ Restore Data ◆</h2>

Order matters here. Foundation auth comes first, because every other app on the phone depends on being able to log in, and login depends on TOTP codes, and TOTP codes depend on the authenticator app, which itself depends on a password manager to look up the right account. Work outward from that root.

<div class="dgw-callout dgw-callout--warn"><strong>Paper first.</strong> The single biggest snag is 2FA recovery codes. Have them printed on paper before the wipe. Without them, lockout from half the account list happens at the worst possible moment.</div>

### 1. Password manager (Bitwarden)

Install Bitwarden from the Google Play Store or F-Droid. Log in with the master password. Bitwarden will ask for a TOTP code from the authenticator app, which is not installed yet, so use the printed two-step-login recovery code instead. Once logged in, go to Account Settings, two-step login, and generate a fresh recovery code. The old one is now considered exposed (it has been sitting on paper in plain sight) and the previous device's TOTP seed is gone.

### 2. TOTP authenticator (Proton Authenticator)

Install Proton Authenticator. Log in with the Proton account password and the printed Proton recovery code. The encrypted TOTP vault syncs down from Proton's cloud, restoring every other service's codes in one shot. Generate a new Proton account recovery code immediately and store the new sheet.

### 3. Enterprise 2FA (optional)

If work or school uses Microsoft Authenticator, install it and cloud-restore from the linked personal Microsoft account. Push-approval accounts may still require re-enrollment through the IT portal.

### 4. Signal

Install Signal. Register the same phone number. When prompted, paste the Signal Secure Backups recovery key saved before the wipe. Message history, media, and group memberships restore from cloud. This is the cleanest restore path of any messenger on the list.

### 5. WhatsApp (the fiddly one)

Install WhatsApp from the Google Play Store but do not open it yet. Opening it before the local backup is in place will create a fresh empty database that blocks the restore prompt.

Re-enable USB debugging under <span class="settings-path">Settings<span class="settings-path-sep">→</span>System<span class="settings-path-sep">→</span>Developer options</span>. Plug the phone into the Mac and push the backup tree back:

```bash
adb push "/path/to/backup/whatsapp/com.whatsapp/" /sdcard/Android/media/com.whatsapp/
```

Now open WhatsApp, register with the same phone number, and at the "Found a local backup" prompt tap Restore.

<details><summary>If the restore prompt never appears</summary>

This restore path works about 80% of the time on GrapheneOS. WhatsApp occasionally changes its backup directory structure between releases, and a backup from an older version may not match what the new install expects.

Fallback options:

- Per-chat archives exported from WhatsApp Desktop before the wipe are still readable as plain zip files. They cannot be re-imported into WhatsApp, but the message contents and attachments are recoverable for reference.
- If the most important chats are with a small number of people, ask them to re-share key attachments after registration.
- Linked devices (WhatsApp Desktop, WhatsApp Web) re-link cleanly and pull recent history forward, even if the local restore failed.

</details>

### 6. File-based apps (Obsidian, etc.)

For anything that stores its data as plain files, push the folder back to the same location and point the app at it:

```bash
adb push "/path/to/backup/Documents/ObsidianVault" /sdcard/Documents/
```

Open Obsidian, choose "Open folder as vault", and select the restored directory. Repeat for any other file-based tools.

### 7. Cloud-synced apps

Proton Mail, Proton Calendar, Proton Drive, Ente, Bitwarden secondary devices, and similar services need only install plus login. Data streams down on first sync. Give Ente time to rebuild thumbnails before judging whether the library looks right.

### 8. Banking and payments

Expect a 2FA re-enrollment dance for each banking app. Most will send an SMS or email code, then ask security questions. Cash App and Venmo go faster if they were pre-deregistered from their web dashboards before the wipe, which avoids the fraud-hold flow that triggers when a "new device" tries to authenticate against an active session. Check each app against the [GrapheneOS banking compatibility list](https://privsec.dev/posts/android/banking-applications-compatibility-with-grapheneos/) if anything refuses to launch.

<details class="dgw-why"><summary>Why this matters</summary>

Restoring a phone is a chicken-and-egg problem. Logging into any account needs a password, the password lives in a password manager, the password manager needs a TOTP code, the TOTP code lives in an authenticator app, and the authenticator app needs to be logged in, which needs a password. The only way to break the loop is paper: printed recovery codes for the two root accounts (password manager and TOTP authenticator) that bootstrap everything else. Skipping that step before the wipe is how people get locked out of their own data.

Sandboxing makes restore harder than on stock Android. Each app on GrapheneOS sees its own private storage and nothing else, so the old "just sign into a Google account and watch everything come back" flow does not exist. Each app has to be restored on its own terms, through its own backup mechanism, in the right order. The upside is the same property that makes it inconvenient: one compromised app cannot rummage through another app's data.

WhatsApp restore is fragile because the app's local backup format is undocumented and changes between releases, and because WhatsApp's official restore path assumes Google Drive backups that GrapheneOS users typically do not have. The adb-push workaround threads a real needle and works most of the time, but it is the single most likely step in the whole migration to fail. Treating chat history as nice-to-have rather than must-have removes a lot of stress from this part of the process.

</details>
</section>

<section id="fix-google-contacts-and-calendar-sync-with-davx5">
<h2>◆ Fix Google Contacts And Calendar Sync With DAVx5 ◆</h2>

After signing into a Google account on GrapheneOS, Contacts and Calendar will appear broken. The dialer shows raw phone numbers instead of names, Fossify Messages (or whatever SMS app is in use) shows numbers instead of contact labels, and the system Calendar is empty even though Google Calendar has years of events.

This is expected. On stock Android, signing into Google triggers a privileged sync adapter bundled with Play services that writes directly into the system ContactsProvider and CalendarProvider. On GrapheneOS, Sandboxed Google Play runs as an ordinary, unprivileged app and cannot reach those system providers. The [GrapheneOS usage docs](https://grapheneos.org/usage) put it plainly: "Functionality depending on the OS integrating Play services and using it as a backend is unavailable."

The fix is a third-party sync client that speaks the open standards Google already exposes: CardDAV for contacts, CalDAV for calendars. [DAVx5](https://www.davx5.com/) does exactly that, and writes results into the system providers so every app on the phone sees the data.

### Pricing note

DAVx5 is free on [F-Droid](https://f-droid.org/packages/at.bitfire.davdroid/) and $6.50 on the Google Play Store. Both builds are the same app. The paid Play version is a "support the developer" donation build with no extra features. Install from F-Droid and tip the developer separately if desired.

### Setup

<ol class="steps">
<li>Install DAVx5 from F-Droid.</li>
<li>Open it and tap the + (Add account) button.</li>
<li>Choose "Login with Google" and complete the OAuth flow in the browser sheet that appears.</li>
<li>On the account screen, toggle Contacts and Calendar on.</li>
<li>Tap the refresh icon to force an initial sync.</li>
</ol>

After the first sync completes, dialer caller ID works, the SMS app resolves numbers to names, and the system Calendar shows Google events alongside any local calendars.

### Bonus

The same DAVx5 install can sync any other CardDAV/CalDAV endpoint at the same time. When swapping Google Calendar and Google Contacts for Proton Calendar and Proton Contacts later (see the Full de-Google section), add the Proton account in DAVx5 and both providers sync side by side until the cutover is finished.

<details class="dgw-why"><summary>Why this matters</summary>

CardDAV and CalDAV are open IETF standards for contacts and calendar sync. Because the data and the transport are decoupled from any single vendor, the same client (DAVx5) can talk to Google, Proton, Nextcloud, Fastmail, or a self-hosted Radicale server with no change to how apps on the phone read the data. The system ContactsProvider and CalendarProvider stay the source of truth, and every app keeps working regardless of where the bytes came from.

This pattern is durable. Switching providers later (Google to Proton, Proton to self-hosted, or anything else) becomes an account-swap inside DAVx5 rather than a migration that touches every app on the device. It also makes mixed setups trivial: a personal calendar on one provider and a shared family calendar on another can coexist without either side knowing about the other.

</details>
</section>

<section id="browsers">
<h2>◆ Browsers ◆</h2>

The browser is the largest attack surface on any phone. Pick two, use them for different jobs, and keep both patched.

### Recommended dual setup

Run **Vanadium** for sensitive browsing (banking, email, anything tied to a real identity) and **IronFox** for daily browsing where extensions and ad blocking matter.

Vanadium ships pre-installed with GrapheneOS. It is a hardened Chromium build with per-site process isolation and Android's strongest renderer sandbox. No configuration is required to benefit from it.

IronFox is a hardened Firefox (Gecko) build available on F-Droid. It strips proprietary libraries and telemetry, ships privacy-respecting defaults, and bundles uBlock Origin. The tradeoff: Gecko on Android does not yet implement per-site process isolation, so a renderer compromise has a larger blast radius than the equivalent in Vanadium.

### Why two browsers

Different engines fail in different ways. Keeping sensitive sessions in Vanadium and disposable browsing in IronFox limits cross-contamination. If an ad network on a news site ships a malicious payload, it lands in the browser without the bank session cookies.

### The Mythos Preview context

In April 2026, Anthropic [disclosed an unreleased model](https://red.anthropic.com/2026/mythos-preview/) that identifies and exploits zero-day vulnerabilities at unprecedented scale, including browser sandbox-escape chains that combine four vulnerabilities to escape both the renderer and the underlying OS sandbox. Per Anthropic, under 1% of disclosed vulnerabilities are patched in deployed software.

The practical reading for end users: patch cadence is now a first-class security property, and per-site process isolation matters more than it used to. A browser that ships fixes within days of upstream is materially safer than one that ships them within weeks, and a sandbox that contains a renderer compromise to a single origin is materially safer than one that does not.

### Browser comparison

| Browser  | Sandbox model                          | Extensions               | Ad blocking          | Status                          |
|----------|----------------------------------------|--------------------------|----------------------|---------------------------------|
| Vanadium | Chromium, per-site process isolation   | None                     | None built in        | Maintained by GrapheneOS        |
| IronFox  | Gecko, single renderer process         | Full WebExtensions       | uBlock Origin bundled| Actively maintained             |
| Firefox  | Gecko, single renderer process         | Limited curated list     | Manual install       | Maintained, weaker defaults     |
| Mull     | Gecko, single renderer process         | Full WebExtensions       | Built in             | Archived 2025, do not use       |
| Brave    | Chromium, per-site process isolation   | Chrome extension subset  | Built in (Shields)   | Maintained, includes crypto features |

### What not to use

Do not use **Mull**. The [project was archived in 2025](https://gitlab.com/divested-mobile/mull-fenix) and no longer receives upstream Mozilla patches. Any copy still installed should be replaced with IronFox.

Do not use **vanilla Firefox** as the primary browser. It has the same Gecko sandbox limits as IronFox but ships weaker privacy defaults and more telemetry. If a Gecko browser is wanted, pick IronFox.

### Default search

In both browsers, set the default search engine to **DuckDuckGo** (free) or **Kagi** (paid, no ads, no tracking). Avoid Google as default. The DuckDuckGo and Kagi options are present in the built-in engine list for both Vanadium and IronFox.

### Optional additions

- **Tor Browser** (F-Droid): for onion sites and high-anonymity browsing.
- **Orbot** (F-Droid): routes traffic from other apps through Tor.
- **Brave**: a reasonable single-browser option for readers who want one Chromium-based browser with built-in ad blocking and accept the bundled crypto features.

<details>
<summary>If a site breaks in Vanadium</summary>

Vanadium disables several Chromium features by default for hardening. If a site refuses to load or render correctly, open it in IronFox instead rather than weakening Vanadium settings. Reserve Vanadium for the small number of high-trust sites where the stricter posture matters.

</details>

<details class="dgw-why"><summary>Why this matters</summary>

The browser is the most-attacked surface on a modern phone. It executes untrusted code from every website it visits, parses dozens of complex file formats, and has direct network access. Most real-world compromises of mobile devices start in the browser, not in the OS itself.

Per-site process isolation means each website runs in its own operating-system process with its own sandbox. If one site exploits a bug in the rendering engine, it cannot read data from other sites' tabs without also escaping the OS sandbox, which is a much harder second step. Browsers without per-site isolation share one renderer across origins, so a single renderer compromise can read across tabs.

Patch cadence is the other half of the equation. A browser that ships upstream security fixes within days closes the window during which a known vulnerability is exploitable. With automated vulnerability discovery now demonstrated at scale, the gap between "fix landed upstream" and "fix on the device" is the practical measure of how exposed a browser is on any given day. Picking browsers with short patch cadences and keeping them updated is no longer optional hygiene; it is the security posture.

</details>
</section>

<section id="google-service-alternatives">
<h2>◆ Google Service Alternatives ◆</h2>

Be honest about what swaps buy. Replacing peripheral services (Search, Maps, the YouTube client) without replacing the big three (Gmail, Calendar, Drive) reduces exposure only at the margins. The single highest-impact move is replacing Gmail with a different provider plus an alias service, because mail is the root of every password reset, every account-recovery flow, and every "magic link" login. If Gmail stays, Google still sees the metadata graph of every service in active use. Treat the mail swap as the headline change and treat the rest as exposure-reduction around it.

The swaps below are ordered roughly from low-friction to high-friction. Adopt them in whatever order matches the available time budget.

### Swap table

| Google service | Replacement | Where to get | Notes |
|---|---|---|---|
| Google Search | DuckDuckGo, Kagi, or Brave Search | Browser settings | Set as default in Vanadium and IronFox. Kagi is paid and ad-free. |
| Google Maps | Organic Maps | F-Droid | OpenStreetMap-based, offline-capable. Keep Google Maps for general use if needed; route sensitive trips through Organic Maps. |
| Google Photos | Ente | Play Store or [ente.com](https://ente.com) | Paid, end-to-end encrypted, open source. |
| Google Drive | Proton Drive | Play Store or F-Droid via Obtainium | Paired naturally with a Proton Mail plan. |
| Google Calendar | Proton Calendar | Play Store | Sync to the system calendar via DAVx5 so other apps can read events. |
| Gmail (full de-Google) | Proton Mail | Play Store | Use [SimpleLogin](https://simplelogin.io) or [Addy.io](https://addy.io) aliases for new signups so the canonical Proton address is never exposed. This is the single biggest move on the list. |
| Google Authenticator | Proton Authenticator, or Aegis | Play Store / F-Droid | Aegis is fully local, encrypted, and exportable. Proton Authenticator syncs across devices if a Proton account is in use. |
| Google Tasks | Tasks.org | F-Droid | CalDAV-compatible; works with the Proton/DAVx5 stack. |
| Google Translate | DeepL, or Mozhi | Play Store / F-Droid | DeepL wins on quality. Mozhi is a FOSS frontend to multiple translation backends. |
| YouTube (viewing) | NewPipe or LibreTube | F-Droid | No Google login, no ads, no algorithm. Cannot comment, like, or upload. See comparison below. |
| Google Messages | Fossify Messages | F-Droid or Play Store | GPL-3.0. See RCS caveat below. |
| Google Wallet | Physical cards plus Privacy.com virtual numbers | n/a | Tap-to-pay is broken on GrapheneOS by design (Play Integrity required). |
| Google Pay | Same as Wallet | n/a | Same constraint. |
| Android Auto | GrapheneOS build of Android Auto | GrapheneOS Apps repo (<span class="settings-path">Apps<span class="settings-path-sep">→</span>GrapheneOS apps<span class="settings-path-sep">→</span>Android Auto</span>) | Runs with reduced privileges versus the stock build. |
| Google Voice | Carrier number, or JMP.chat | Carrier / [jmp.chat](https://jmp.chat) | JMP.chat is a privacy-respecting alternative with XMPP delivery. |

### NewPipe versus Firefox plus uBlock for YouTube viewing

Both block ads. The mechanism is different and the tradeoffs are worth naming.

- NewPipe pulls video metadata and streams without ever talking to YouTube's player or ad endpoints. Ads are never fetched. There is no Google account in the loop and no behavioral profile is built.
- Firefox plus uBlock loads the standard YouTube page and blocks ad requests at the network layer. The session still touches Google's player, still ships a fingerprint, and still feeds the watch-history graph if signed in.

NewPipe wins on telemetry exposure. Firefox plus uBlock wins on commenting, subscriptions, and engagement features. A common split: NewPipe for daily viewing, the official app (or web) signed in for channel admin or comments.

### RCS caveat

No FOSS RCS client exists. Google holds the Jibe infrastructure that powers RCS for Android. Apple negotiated direct access. Nobody else has. Switching from Google Messages to Fossify Messages means RCS-capable contacts silently downgrade to SMS on the device. Group chats with iPhone users and Google Messages users will still work, but as SMS/MMS, with the quality loss that implies. For anything richer, push contacts to Signal.

### Phased switching

Start with three high-impact, low-friction swaps:

<ol class="steps">
<li>Set DuckDuckGo (or Kagi) as the default search engine in Vanadium and IronFox.</li>
<li>Install Organic Maps as a secondary mapping app for routes that do not need to live in a Google account.</li>
<li>Install NewPipe for daily YouTube viewing.</li>
</ol>

These three cost nothing, break nothing, and meaningfully cut the daily query volume sent to Google. Add Proton Mail plus an alias service next if a full mail migration is on the table. Layer the rest in as the friction allows.

<details class="dgw-why"><summary>Why this matters</summary>

Concentrating mail, calendar, contacts, photos, documents, search, navigation, and video on a single provider creates a single point of disclosure. One legal request, one credential compromise, or one account-level suspension can expose or sever access to every service at once. Even absent any adversarial event, the metadata graph a single provider can assemble across all of those signals is far richer than the sum of its parts.

Partial swaps still reduce that exposure. Every query routed to a different search engine, every route plotted in a different map app, and every video watched outside the logged-in client trims the behavioral profile and improves exit-readiness for a later, fuller migration. Exit-readiness is itself the point: services that have been used in parallel for months are far cheaper to switch to under pressure than services adopted cold.

Some Google services are genuinely hard to leave. Calendar invites, shared documents, and YouTube channels carry network effects that the user does not fully control. Professional and educational ecosystems often mandate Google accounts. A realistic plan accepts that the migration is partial and gradual, and prioritizes the swaps with the highest ratio of exposure reduction to daily friction.

</details>
</section>

<section id="full-degoogle-replacing-gmail-calendar-drive">
<h2>◆ [Full De-Google] Replacing Gmail, Calendar, and Drive ◆</h2>

This section covers the optional second phase: leaving Gmail, Google Calendar, Google Contacts, and Google Drive for [Proton](https://proton.me). Skip it if the partial setup is enough. Return to it later if it is not.

### Replace Gmail with Proton Mail

<ol class="steps">
<li>Create a Proton account. The free tier works for evaluation; paid tiers add custom domains and more storage.</li>
<li>Export Gmail history via <a href="https://takeout.google.com">Google Takeout</a> (select Mail) as MBOX.</li>
<li>Import the MBOX into Proton Mail using Proton's Import-Export tool, or use the Easy Switch web flow to pull directly from Gmail with OAuth.</li>
<li>Set up email aliases through <a href="https://simplelogin.io">SimpleLogin</a> (owned by Proton) or <a href="https://addy.io">Addy.io</a> for every account where Gmail was the contact address.</li>
<li>Migrate accounts to the new aliases one at a time, working through a password manager's login list top to bottom.</li>
<li>Set a Gmail auto-responder pointing to the Proton address for the transition window.</li>
<li>Once mail traffic to Gmail has dropped to near zero (typically 6+ months), wind down the Gmail account. Keep it dormant for a while before deleting in case a forgotten service needs a password reset.</li>
</ol>

<div class="dgw-callout dgw-callout--warn"><strong>Aliases are not optional.</strong> An alias service like SimpleLogin or Addy.io is essential infrastructure for full de-Google. Without it, the new Proton address ends up exposed on every service signup, which recreates the "one inbox knows everything" problem the migration was meant to solve. Use a unique alias per service. When one starts receiving spam, disable that alias and the source is known.</div>

### Replace Google Calendar with Proton Calendar

<ol class="steps">
<li>In Google Calendar, go to <span class="settings-path">Settings<span class="settings-path-sep">→</span>Import &amp; export<span class="settings-path-sep">→</span>Export</span>. This produces an ICS archive.</li>
<li>Import the ICS files into Proton Calendar.</li>
<li>In DAVx5 on the Pixel, add a new account pointing at Proton's CalDAV endpoint (<span class="settings-path">Proton Mail web<span class="settings-path-sep">→</span>Settings<span class="settings-path-sep">→</span>Calendar</span> shows the URL and app password to use).</li>
<li>Verify events sync into the system calendar alongside the existing Google ones.</li>
<li>Once parity is confirmed, remove the Google account from DAVx5 and delete the Google calendars from calendar.google.com.</li>
</ol>

### Replace Google Contacts with Proton Contacts

Proton Contacts ships as part of Proton Mail.

<ol class="steps">
<li>Export from <a href="https://contacts.google.com">contacts.google.com</a> as vCard.</li>
<li>Import into Proton Mail's Contacts panel.</li>
<li>DAVx5 syncs Proton CardDAV to the system ContactsProvider the same way it did with Google, so apps that read the OS contacts database (dialer, Signal, Fossify Messages) keep working.</li>
</ol>

### Replace Google Drive with Proton Drive

Move files over in batches. Update any shared links posted publicly or sent to collaborators. Proton Drive has desktop and mobile clients, plus a web interface. Keep a local copy of anything irreplaceable during the move.

### YouTube

YouTube is the hardest Google service to leave cleanly. For viewing, NewPipe or LibreTube on the phone and a browser tab on desktop cover most use cases without a Google account. For uploads, the federated alternative is [PeerTube](https://joinpeertube.org), but reach is dramatically smaller. A reasonable compromise: keep an existing channel for archival, stop uploading new content there, and treat YouTube as view-only.

### Google Voice and phone numbers

See the carrier section in the Alternatives chapter. [JMP.chat](https://jmp.chat) provides a real phone number routed over XMPP and is one of the few non-Google options for a US number tied to no carrier account.

### Realistic timeline

A full de-Google migration is a 6 to 12 month project for an average user with normal account complexity. Some accounts will resist a clean migration: legacy services with no email-change flow, accounts tied to a phone number that triggers re-verification, work accounts outside personal control. Treat the move as a transition rather than a flip. The Gmail account stays open and forwarding until traffic to it goes quiet on its own.

<details class="dgw-why"><summary>Why this matters</summary>

Email is the root credential for most of online identity. Password resets, signup confirmations, account recovery, billing notices, and second-factor fallbacks all flow through the inbox. Whoever runs the mail server can read, scan, profile, or be compelled to hand over that traffic. Moving mail to a provider that cannot read message bodies (Proton uses zero-access encryption for stored mail) removes the single largest source of passive data collection in a typical digital life.

Aliases compound that benefit. When every service sees a different address, cross-service correlation by email becomes much harder for data brokers and breach aggregators. A breach at one vendor leaks one alias, not the master address, and that alias can be disabled without affecting anything else. Without aliases, the new mail provider eventually accumulates the same identity graph the old one had; the work was for nothing.

Timing matters because migrations are easier when they are voluntary. Account-change flows, export tools, and forwarding rules all work better before a provider deprecates them, raises prices, or changes terms. Doing the move on a relaxed schedule, with months of overlap, is far less stressful than doing it under a deadline imposed by someone else.

</details>
</section>

<section id="common-pitfalls">
<h2>◆ Common Pitfalls ◆</h2>

Most migrations fail in the same handful of ways. Work through this list before flashing, and again after first boot.

### Credentials and recovery

- **2FA recovery codes not on paper.** The classic trap: the Bitwarden master 2FA seed lives in Proton Authenticator, which is itself locked behind Bitwarden. Print every recovery code before starting. Treat paper as the root of trust.
- **Crypto seeds only in a password manager.** Same problem, worse outcome. Write seed phrases on paper (or metal) before wipe.
- **Skipping the verified boot key hash check during first boot.** Without verifying the hash against the [official device list](https://grapheneos.org/install/web), there is no cryptographic guarantee the running OS is the genuine GrapheneOS build. For the Pixel 9 Pro, the expected value is `f729cab861da1b83fdfab402fc9480758f2ae78ee0b61c1f2137dd1ab7076e86`.

### Backup and restore

- **WhatsApp restore failure.** The adb-push restore path works roughly 80% of the time. As a read-only fallback, export per-chat archives from WhatsApp Desktop before the wipe so message history survives even if the in-app restore fails.
- **macOS Removable Volumes permission revoking mid-flow.** The per-mount toggle under <span class="settings-path">Files &amp; Folders<span class="settings-path-sep">→</span>Removable Volumes</span> can revoke itself after a drive remount, breaking an adb pull halfway through. Grant Full Disk Access (broader and stickier) to Terminal upfront instead.
- **Forgetting the eSIM survives the wipe.** The eSIM profile lives on the eUICC chip, not in user data. Do not preemptively request a replacement from the carrier unless they confirm the old profile is dead. US Mobile and most major carriers reactivate after one reboot.

### Apps and accounts

- **Cash App and Venmo lock for 24 to 48 hours post-wipe.** Pre-deregister both from their web dashboards before flashing to skip the fraud-hold dance.
- **Trying to reinstall every previously installed app on day one.** Most users touch only 30 to 50 apps. Treat the wipe as a chance to cut bloat, not recreate it.
- **Assuming Google Contacts and Calendar will sync automatically after signing into Google.** They will not. Install DAVx5 and configure the Google account there (see the Fix Sync section).
- **Choosing Aurora Store instead of Google Play Store.** [GrapheneOS recommends sandboxed Google Play](https://grapheneos.org/usage) over Aurora. Aurora's shared-account mode is rate-limited and offers no real privacy gain on GrapheneOS.

### Browser choices

- **Using Mull because older guides recommend it.** [Mull is archived](https://gitlab.com/divested-mobile/mull-fenix) and no longer maintained. Use [IronFox](https://gitlab.com/ironfox-oss/IronFox) instead.
- **Using vanilla Firefox as the primary browser.** Firefox on Android lacks per-site process isolation. Pick IronFox as the Gecko-family choice and pair it with Vanadium for sensitive browsing.

<details class="dgw-why"><summary>Why this matters</summary>

Migration projects fail in predictable patterns. The most common failure mode is circular credential dependency: a recovery code locked behind the very account it would recover. The second is assuming a sync or restore path "just works" without testing it before the point of no return. The third is rushing the irreversible step (the wipe) before the reversible preparation (paper backups, pre-deregistration, export of chat archives) is complete.

A printed checklist and physical (paper or metal) backup of every credential breaks both loops. Paper does not depend on a device, a network, or a vendor staying online. Working through a fixed list also slows the process down enough to catch the small mistakes (a missing seed phrase, an unconfirmed eSIM, a 2FA app left on the old device) that turn a clean migration into a multi-day recovery effort.

</details>
</section>

<aside class="dgw-checklist" data-widget="checklist" aria-label="Migration checklist"></aside>

<section id="next-steps">
<h2>◆ Next Steps ◆</h2>

For a first read-through, work the sections in this order:

1. Two Paths (partial vs full de-Google)
2. Back Up The Old Phone
3. Flash GrapheneOS
4. Harden
5. Install Sources (Sandboxed Google Play, F-Droid, Obtainium)
6. Restore (apps, data, WhatsApp, Signal)
7. Fix Sync (DAVx5 for contacts and calendar)
8. Browsers (Vanadium plus IronFox)
9. Alternatives (NewPipe, Organic Maps, Fossify Messages, DuckDuckGo)
10. Full De-Google (only if going past the partial path)
11. Common Pitfalls, re-read the day before the wipe

If a specific choice is unclear (Partial vs Full, whether to install Sandboxed Google Play, Aurora Store vs Google Play Store, Fossify Messages vs Google Messages), use the decision-tree widget earlier in this guide. It encodes the same tradeoffs without the prose.

### Shelf life

This is a 2026 snapshot. Three things are likely to date it within months:

- The [September 2026 Android sideloading deadline](https://keepandroidopen.org) and whatever Google ships around developer ID verification.
- Follow-on disclosures and patch waves after the [Mythos Preview](https://red.anthropic.com/2026/mythos-preview/) capability writeup.
- Ongoing GrapheneOS releases that change defaults or add features.

Treat this guide as a starting point, not a frozen recipe.

### Sources worth subscribing to

- [grapheneos.org](https://grapheneos.org) for release notes and security advisories.
- [keepandroidopen.org](https://keepandroidopen.org) for sideloading and developer-verification status.
- [PrivSec banking compatibility list](https://privsec.dev/posts/android/banking-applications-compatibility-with-grapheneos/) before installing any new bank app.
- [Privacy Guides Android page](https://privacyguides.org/en/android/) for ongoing comparisons of ROMs and app alternatives.

</section>
