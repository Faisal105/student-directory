# Deploy the student app

Create a Render **Web Service** from the GitHub repository. The React build is served by Express, so one service hosts both.

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Branch | main |
| Root directory | Leave empty |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Instance | Free |
| Health check | `/api/health` |

Set these environment variables in Render:

- `NODE_ENV=production`
- `APP_ORIGIN=https://YOUR-SERVICE.onrender.com` (exact origin, no trailing slash)
- `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: hosted SQL Server/Azure SQL runtime credentials
- `DB_PORT=1433`
- `DB_TRUST_CERTIFICATE=false`

Let Render provide `PORT`. Do not upload `.env`, `.env.sqlserver`, or `.env.local-login.json`. Do not put database administrator credentials in the web service.

The hosted database must be provisioned before the app can start. The SQL Server on your Mac is for local development; Render cannot use `127.0.0.1` to reach it. For Azure SQL, use the explicit free offer with pause-at-quota enabled, allow Render's outbound IP ranges in the database firewall, and verify zero-cost settings.

Apply migrations with operator credentials from a separate local environment file, provision a limited runtime user with the `student_app` database role, then create a reviewer account. Use the existing migration and account scripts; `db:local` is only for the Mac and must not run in Render.

Render may sleep when idle. Verify HTTPS login, create/read/update/delete, logout, and nested-route refresh before sharing the URL. Send the reviewer password privately.
