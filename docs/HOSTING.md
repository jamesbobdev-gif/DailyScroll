# Hosting the Daily Scroll service

The phone app, the browser client and the desktop app all talk to one Node service
(`server.mjs`). Today that service runs on your PC, so the Android APK only works at home
or through a temporary Cloudflare tunnel. This guide puts the service on a small
always-on host with HTTPS so the app works anywhere.

Fly.io is the recommended host. The repo already contains everything Fly needs:
`Dockerfile` (the service image) and `fly.toml` (the Fly settings: port, health check,
persistent storage). You create the account and run the commands below; nothing in the
repo creates accounts or spends money on its own.

**One warning before anything else.** The hosted service must run in limited mode, which
is what the Dockerfile does: `node server.mjs` with no `--testing` flag. Testing mode
(`npm run service`) switches time limits off for everyone. Never add `--testing` or
`SCROLL_TEST_MODE=1` to the hosted service.

## What it costs

Fly bills by the second and has no free tier for new accounts, but the service is tiny.

| Item | Setting in `fly.toml` | About per month (USD) |
| --- | --- | --- |
| One small machine, always on | `shared-cpu-1x`, 512 MB | 3.69 |
| Persistent volume for `data/` | 1 GB | 0.15 |
| Outbound traffic | first 100 GB free in North America and Europe | 0 |
| **Total** | | **roughly 4** |

Dropping the machine to 256 MB saves about 1.50 USD; 512 MB leaves headroom for the
YouTube feed refresh. Figures are from Fly's pricing page in October 2026 and can change.

## One-time setup

### 1. Create the Fly.io account (you)

Go to https://fly.io, sign up, and add a payment card when asked. Fly needs the card
even though the first month is a few dollars. This is the only step that has to be done
in a browser.

### 2. Install flyctl and sign in

Windows (PowerShell):

```powershell
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

If `pwsh` is not found, replace it with `powershell`. On macOS or Linux:

```bash
curl -L https://fly.io/install.sh | sh
```

Close and reopen the terminal, then sign in:

```bash
fly auth login
```

### 3. Create the app from the repo's config

From the repository root on the branch that contains `fly.toml`:

```bash
fly launch --copy-config --ha=false --no-deploy
```

Fly asks for an app name (for example `daily-scroll-james`; it must be unique across
Fly) and a region (pick the one closest to you). Answer **no** if it offers to add a
Postgres or Redis database. `--copy-config` keeps the repo's settings, `--ha=false`
means one machine instead of two, and `--no-deploy` lets you set secrets first.

Fly rewrites the `app` line in `fly.toml` with the name you chose. Your public address
is `https://<app-name>.fly.dev`.

### 4. Create the storage volume

The service keeps everything in `data/store.json` plus an encrypted token vault. Without
a volume, every deploy would wipe it.

```bash
fly volumes create daily_scroll_data --region <your-region> --size 1 --yes
```

The name `daily_scroll_data` must match the `source` in `fly.toml`. Fly mounts it at
`/app/data`; the container fixes the folder's ownership on start, so no extra step.

### 5. Set the secrets

Generate a 64-character hex key for encrypting stored OAuth tokens. Node is already
installed, so:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output, then set the three required secrets in one command (replace the
address and the key):

```bash
fly secrets set PUBLIC_ORIGIN=https://<app-name>.fly.dev COOKIE_SECURE=1 TOKEN_ENCRYPTION_KEY=<the 64 hex characters>
```

- `PUBLIC_ORIGIN` is the address the service believes it lives at; the browser client
  and OAuth redirects use it.
- `COOKIE_SECURE=1` marks sign-in cookies HTTPS-only.
- `TOKEN_ENCRYPTION_KEY` keeps the same encryption key across deploys. Keep a copy of
  it somewhere private (a password manager). If it is lost, connected accounts have to
  be reconnected; nothing else breaks.

Optional provider keys (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and so on, see
`.env.example`) go in with the same `fly secrets set` command whenever you have them.

### 6. Deploy

```bash
fly deploy --ha=false
```

`npm run deploy` runs the same command. Fly builds the Docker image on its own builders
(no Docker needed on your PC), starts the machine, and waits for the `/health` check to
pass. The first deploy takes a few minutes; later ones about one.

### 7. Check it works

```bash
curl https://<app-name>.fly.dev/health
```

The reply should be exactly `{"ok":true}`. Then open `https://<app-name>.fly.dev` in a
browser: the Daily Scroll web client should appear. Useful commands:

```bash
fly status
```

```bash
fly logs
```

The log should say `The Daily Scroll is running on port 8787. Open ...` **without**
`(time limits disabled for testing)`. If it shows that phrase, the service is in testing
mode; remove any `SCROLL_TEST_MODE` secret with `fly secrets unset SCROLL_TEST_MODE`.

### 8. Point the phone app at it

Follow [ANDROID-APK.md](ANDROID-APK.md) to rebuild the APK, with the service address
baked in so the setup screen never appears:

```powershell
$env:EXPO_PUBLIC_SERVICE_URL = "https://<app-name>.fly.dev"
```

Then run the prebuild and Gradle steps from that document and install the new APK. Phones
that already have the old APK can instead type `https://<app-name>.fly.dev` into the
service address screen.

## Day-to-day

- **Ship an update:** pull the latest code, then `npm run deploy` (or
  `fly deploy --ha=false`). Data on the volume survives.
- **Backups:** Fly snapshots the volume daily and keeps snapshots for five days.
  `fly volumes snapshots list <volume-id>` shows them. For a manual copy:
  `fly ssh console -C "cat /app/data/store.json" > store-backup.json`.
- **Restart:** `fly machine restart <machine-id>` (ids from `fly status`).
- **Stop paying:** `fly apps destroy <app-name>` removes the machine, the volume and
  its data.

## If something goes wrong

- **Deploy fails on the health check.** Run `fly logs`. A crash on start usually means a
  secret has a bad value; `TOKEN_ENCRYPTION_KEY` must be exactly 64 hex characters or
  the service refuses to start.
- **Health passes but settings reset after a deploy.** The volume is not mounted or not
  writable. `fly ssh console -C "ls -ld /app/data"` should show the folder owned by
  `node`. `fly volumes list` should show one volume attached to the machine.
- **Browser says "Request origin refused".** `PUBLIC_ORIGIN` does not match the address
  in the browser. It must be `https://` plus the exact hostname, no trailing slash.
- **Two machines appeared.** Fly's default is two for redundancy, which this service's
  single JSON file cannot share. `fly scale count 1` fixes it.

## Render and Railway instead of Fly

The same `Dockerfile` works on both. Differences in short:

| | Fly.io | Render | Railway |
| --- | --- | --- | --- |
| Create | `fly launch` from the repo | New Web Service, Docker runtime, connect the GitHub repo | New project from GitHub repo (Docker auto-detected) |
| Persistent storage | volume in `fly.toml` at `/app/data` | add a Disk, mount path `/app/data` (needs a paid instance; free tier has no disks) | add a Volume, mount path `/app/data` |
| Port | `PORT=8787` in `fly.toml` | set env `PORT=8787` | Railway injects `PORT`; the service reads it |
| Health check | `/health` in `fly.toml` | Health Check Path `/health` in settings | `healthcheckPath: "/health"` in `railway.json` or settings |
| Secrets | `fly secrets set` | Environment tab | Variables tab |
| HTTPS address | `https://<app>.fly.dev` | `https://<service>.onrender.com` | `https://<service>.up.railway.app` |
| Rough cost | about 4 USD per month | Starter 7 USD plus disk about 0.25 USD per GB | Hobby plan 5 USD minimum, usage-based |

On any of them, set the same three secrets (`PUBLIC_ORIGIN` as that host's HTTPS
address, `COOKIE_SECURE=1`, `TOKEN_ENCRYPTION_KEY`) and verify with the same `/health`
request.
