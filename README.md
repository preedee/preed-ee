# preed.ee

Personal projects dashboard. Scans `~/Desktop/Cowork/`, emits a static site, deploys to GitHub Pages on the apex domain `preed.ee`.

## Structure

```
preed-ee/
├── scripts/scan-projects.ts    # Bun scanner — reads git/fs metadata
├── site/                        # GitHub Pages root (publish this folder)
│   ├── index.html
│   ├── styles.css
│   ├── projects.json            # data artifact
│   ├── CNAME                    # preed.ee
│   └── .nojekyll
└── launchd/
    └── com.preedee.preed-ee-rebuild.plist
```

## Local workflow

```bash
bun run scan      # rescans Cowork/, rewrites projects.json + injects data into index.html
open site/index.html
```

The page is fully self-contained — the project data is inlined into `index.html` between `<!-- DATA:START -->` / `<!-- DATA:END -->`. It works over `file://`, no server needed.

## Deploy to GitHub Pages

One-time setup (replace `YOUR-USER` with your GitHub username):

1. **Create the repo** on github.com — `YOUR-USER/preed-ee`, public.
2. **Push this folder:**
   ```bash
   cd ~/Desktop/Cowork/preed-ee
   git init
   git add .
   git commit -m "initial"
   git branch -M main
   git remote add origin git@github.com:YOUR-USER/preed-ee.git
   git push -u origin main
   ```
3. **Enable Pages:** repo → Settings → Pages → Source: *Deploy from a branch* → Branch: `main`, Folder: `/site` → Save.
4. **DNS for preed.ee** (at your registrar). For an apex domain, add these A records pointing at GitHub's Pages IPs:
   ```
   A   @   185.199.108.153
   A   @   185.199.109.153
   A   @   185.199.110.153
   A   @   185.199.111.153
   ```
   Also add (optional, for IPv6):
   ```
   AAAA  @  2606:50c0:8000::153
   AAAA  @  2606:50c0:8001::153
   AAAA  @  2606:50c0:8002::153
   AAAA  @  2606:50c0:8003::153
   ```
5. Back in repo Pages settings → set *Custom domain* to `preed.ee` and tick *Enforce HTTPS* once cert provisions (can take 15–60 min).

## Daily rebuild via launchd

The plist runs the scanner, commits if `projects.json` changed, and pushes.

```bash
cp launchd/com.preedee.preed-ee-rebuild.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.preedee.preed-ee-rebuild.plist
```

It runs daily at 09:00 local. To trigger manually: `launchctl start com.preedee.preed-ee-rebuild`.

Logs: `~/Desktop/Cowork/preed-ee/launchd/rebuild.log`.

**Auth note:** launchd runs without your interactive shell env. For `git push` to work non-interactively, your remote must be SSH with a key that's unlocked at login (add it to the Keychain via `ssh-add --apple-use-keychain ~/.ssh/id_ed25519`), OR use an HTTPS remote with credentials cached by `osxkeychain`. If pushes fail silently, check the log.

## Adding a new project

The scanner reads `~/Desktop/Cowork/` dynamically, so new directories show up automatically. To get a nicer stack/purpose label, add an entry to the `META` map in `scripts/scan-projects.ts`. Otherwise it shows `—`.

## Anti-scope

This site only publishes project names, dates, stack, and one-line purpose. No code, no commit messages, no file contents. Safe to expose publicly.
