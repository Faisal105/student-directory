# Student Directory

A small React frontend, Express backend, and Microsoft SQL Server database. Includes student create/read/update/delete and account login. Plain JavaScript, CSS, parameterized SQL, and no ORM.

## Local SQL Server on this Mac

The dedicated Colima profile is `student-sql` (4 GB RAM, 20 GB virtual disk). Data lives in the Docker volume `student-sql-data`.

```sh
colima start student-sql
npm run db:local
```

The setup command creates `.env`, a local SQL Server container, database, exact student table, and a reviewer login. Generated secrets are saved only in ignored files with owner-only access. Find the initial app login in `.env.local-login.json`; do not share or commit this file. Re-running setup preserves existing data and credentials.

To stop the database VM: `colima stop student-sql`. Do not delete the profile or Docker volume if you need to keep the data.

## Fresh setup on another machine

The current Mac is already configured; do not overwrite its `.env` file. Start it with `colima start student-sql` and `npm run dev`. The steps below are for a fresh setup.

1. Install dependencies: `npm install`.
2. Copy `.env.example` to `.env` and enter your local SQL Server settings.
3. Run `npm run db:migrate` to create the tables.
4. Run `npm run user:create` to create a login (password entry is hidden).
5. Optionally run `npm run db:seed` for three synthetic students.
6. Run `npm run dev`, then open http://localhost:5173.

The frontend uses port 5173 and proxies `/api` to Express on port 3000. The server requires a real SQL connection; no mock database or login bypass is enabled.

## Structure

- `client/src/App.jsx`: login, student list, form, and detail screens.
- `client/src/styles.css`: responsive styling.
- `server/src/app.js`: API routes, authentication, validation, and errors.
- `server/src/store.js`: SQL queries.
- `server/src/config.js`: environment configuration.
- `database/migrations/001_initial.sql`: the student table specified by the task, plus Users and Sessions for login.
- `server/scripts/`: migration, seed, and account management commands.

The student table uses INT IDENTITY for StudentId; NVARCHAR(100) for Name and Email; NVARCHAR(20) for Phone; NVARCHAR(50) for Department; and DATETIME for CreatedDate. All fields are required. Email uniqueness is an application design choice. Users can manage all shared student records.

## Security

Passwords use Argon2id. Random session tokens are sent in HttpOnly cookies; only token hashes are stored in SQL. Production cookies also require HTTPS. All student routes require authentication. Inputs are validated, queries use typed parameters, and mutation requests must match APP_ORIGIN. Login attempts are rate-limited in memory (limits reset on restart). Sessions expire after eight hours. Re-running `user:create` for an existing account can rotate its password and revoke sessions.

Use `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD` only for setup commands. The application user should belong to the `student_app` role created by the migration. Local `.env` files are ignored by Git. Never commit credentials or share the database admin password.

## Checks

- `npm test`: API behavior tests with an isolated in-memory test double; these do not prove SQL connectivity.
- `npm run lint`: backend/config JavaScript lint.
- `npm run build`: production React compilation.
- `npm run test:sql`: real SQL create/read/update/delete check; creates and cleans up only its own unique test record.
- `npm run test:e2e`: browser login and CRUD test while `npm run dev` is running; uses installed Google Chrome and the private local login file.

For a production build: `npm run build`, set `NODE_ENV=production` and an HTTPS `APP_ORIGIN`, then `npm start`. Express serves both the API and React build. Local development uses two processes via `npm run dev`.

SQL Server on Apple Silicon requires unsupported x86 emulation. The local setup is for development only. See `SETUP_STATUS.md` for what has actually been installed and tested. Hosting and GitHub publication are separate from running the app locally.
