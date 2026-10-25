# Verified local setup

Updated 25 October 2026.

- React frontend and Express backend are implemented and running at **http://localhost:5173**.
- Microsoft SQL Server 2022 Developer Edition **16.0.4305.5** is running locally in a dedicated Colima/Docker x86 Linux VM.
- Database: `student_crud_dev`; local endpoint: `127.0.0.1:1433`.
- `dbo.Students` was created and its six column names, types, and lengths were verified against the task PDF. `StudentId` is an identity primary key, and `CreatedDate` is database-generated.
- `dbo.Users` and `dbo.Sessions` support login; `dbo.SchemaMigrations` records setup.
- A limited-permission runtime SQL user and a reviewer account were created. Three synthetic students were seeded.
- Initial app login: `.env.local-login.json`. SQL credentials: `.env`. Both files are ignored by Git and have owner-only permissions.
- Installed free local tools: sqlcmd 1.10.0, Colima, Docker CLI, QEMU, and Lima x86 guest support. Existing Node 26.0.0 and npm 11.12.1 are unchanged.
- Colima profile: `student-sql`, 2 virtual CPUs, 4 GB RAM, 20 GB virtual data disk. Docker context: `colima-student-sql`; container: `student-sql`; persistent volume: `student-sql-data`.

## Checks

- Four API behavior/security tests passed.
- A real SQL Server integration test passed: create, read, update, delete, immutable creation timestamp, and duplicate-email rejection.
- Chrome browser workflow passed: login, create, details, edit, persistence after refresh, delete, logout.
- Mobile layout checks and screenshots verify login, directory, and form at 390 px width.
- Production React build and backend/config lint passed.

## Start and stop

After restarting your Mac:

```sh
colima start student-sql
npm run dev
```

Open http://localhost:5173 (use this exact hostname for login).

Stop the frontend/backend with Ctrl+C in the running terminal. Stop the database VM with `colima stop student-sql`. Data survives a normal stop/start; deleting the VM or Docker volume can remove the data.

## Limits

SQL Server on Apple Silicon uses x86 emulation, which Microsoft does not officially support. It has been verified working on this machine for the local app. It can start more slowly than a native server. No paid services or cloud resources were created. GitHub publication and remote hosting are deferred while completing the requested simple local app.
