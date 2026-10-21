# Connect platform accounts

People do not need a Daily Scroll account. Room invites, saved posts, and the daily timer use an anonymous device profile. Each social platform requires its own verified connection before scrolling. The setup below is required to activate those real platform sign-ins.

The connection code is prepared. Provider applications, approved credentials, and a public HTTPS service address are still required to activate the connections.

## First: Google / YouTube

1. Sign into the Google Cloud console tab opened beside the app.
2. Create a project named **The Daily Scroll**.
3. Set up Google Auth Platform branding and audience. For testing, add your Google account as a test user.
4. Create a **Web application** OAuth client.
5. Register `https://YOUR_SERVICE/api/oauth/youtube/callback` as the redirect URI. Google also permits `http://localhost:8787/api/oauth/youtube/callback` for local web testing.
6. Save the client ID and secret privately in the service’s `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Do not put secrets into chat, frontend code, or the phone app.
7. Set `PUBLIC_ORIGIN` to the registered origin and restart the service with `node --env-file=.env server.mjs`.
8. Enable YouTube Data API v3 and configure the read-only YouTube scope. Test Google sign-in and subscription uploads. This does not copy YouTube Home or Shorts recommendations.

## Other registrations

| Platform | Developer portal | Registered callback |
| --- | --- | --- |
| Instagram and Facebook | [Meta for Developers](https://developers.facebook.com/apps/) | `/api/oauth/instagram/callback`, `/api/oauth/facebook/callback` |
| TikTok | [TikTok for Developers](https://developers.tiktok.com/) | `/api/oauth/tiktok/callback` |
| Twitch | [Twitch developer console](https://dev.twitch.tv/console/apps) | `/api/oauth/twitch/callback` |
| Snapchat | [Snap developer portal](https://kit.snapchat.com/portal/) | `/api/oauth/snapchat/callback` |

Use the same public HTTPS origin for all callbacks and room invites. Each platform can require ownership verification, a privacy policy, terms, an app demonstration, account eligibility, and review. Complete those requirements accurately; account creation and accepting provider terms need the account owner.

Google requests identity plus read-only YouTube access. Twitch requests `user:read:follows`; the service loads followed live streams. Both connections save encrypted refresh grants to keep people signed in. The other adapters currently request identity only. Instagram’s adapter is for professional accounts. TikTok identity does not include its For You feed. Snapchat Login Kit does not include private chats, Stories, or a personal Spotlight feed.

Provider steps and constraints are linked in `README.md`. Neither the provider registrations nor app-store distribution are complete.
