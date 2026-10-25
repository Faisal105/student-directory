# Student CRUD application: requirements and implementation guide

Prepared 24 October 2026. Historical planning reference. On 25 October the scope was simplified to a local React + Express + SQL Server app. See README.md and SETUP_STATUS.md for the current implementation and verified status; hosting and publication are deferred.

## 1. Task analysis and scope

Source: `Case Study- Developer Position.pdf`, one page, reviewed in full.

The assignment explicitly requires React.js, Node.js with Express, and **Microsoft SQL Server**. It asks for four student operations: create, read details, update, and delete. PostgreSQL, MySQL, and SQLite are not replacements that satisfy this stated database requirement.

Your additions are authenticated team access, a shareable deployed URL, GitHub source code, and free tools/hosting. Keep these additions small; the assignment describes its scope as very limited.

| Requirement | Origin | Acceptance condition |
| --- | --- | --- |
| Create student | PDF | A valid form saves a SQL record and displays its generated ID |
| Read students and individual details | PDF | List and detail views load saved records from the API |
| Update student | PDF | Changes persist after refresh; ID and creation date remain unchanged |
| Delete student | PDF | Confirmation precedes deletion; deleted record disappears and returns 404 |
| Exact student field types | PDF | Schema matches the table below |
| Login and logout | Your request | Unauthenticated visitors cannot access student data through the API |
| Shareable HTTPS URL | Your request | Team can log in and exercise all four operations |
| GitHub repository | Your request | Source, setup instructions, SQL migrations, and tests are available |
| Free deployment | Your request | No paid plan, paid add-on, or billable overage enabled |

Excluded from version 1: public registration, password-reset email, social login, permissions dashboards, uploads, analytics, microservices, Redis, GraphQL, and an ORM. All provisioned reviewers can exercise CRUD on shared synthetic demo data. This is an explicit assumption; login is access control, not a read-only preview.

## 2. Recommended architecture

Use one repository, one Express application, and one SQL database per environment.

```text
Team browser
    | HTTPS, same-origin requests and session cookie
    v
Render free web service
    |-- React production build served by Express
    |-- /api/auth/*
    |-- /api/students/*
    |
    | encrypted database connection
    v
Azure SQL Database, free allocation, pause at quota
```

React and Express remain separate source folders but ship in the same service. This provides one link and avoids cross-site cookies and unnecessary CORS configuration. The database is hosted separately. During development, Vite proxies `/api` to Express.

| Layer | Choice | Reason |
| --- | --- | --- |
| Frontend | React, Vite, JavaScript, plain CSS | Small and familiar setup |
| Navigation | React Router | Login, list, and student routes |
| Backend | Node.js 24 LTS, Express | Predictable supported runtime; pin an updated patch at implementation |
| SQL access | `mssql` using its Tedious driver | Parameterized T-SQL without an ORM |
| Validation | Zod on API inputs | Explicit field and length rules |
| Password hashing | Argon2id library | Established password-hashing implementation |
| Sessions | Random opaque token, SQL-backed session records | Immediate logout and persistence across app restarts |
| Security middleware | Helmet, cookie-parser, express-rate-limit | Small, focused dependencies |
| Testing | Node test runner + Supertest; one Playwright smoke flow | Cover security boundaries and real CRUD |

Use React state and a small API helper. Introduce no global state framework or generic repository abstraction. API routes call focused query functions; add service modules only if actual business logic needs them.

## 3. Database design

### Required student table

| Column | SQL type | Rule |
| --- | --- | --- |
| StudentId | INT IDENTITY(1,1), primary key | Database-generated, immutable |
| Name | NVARCHAR(100) | Trimmed, required |
| Email | NVARCHAR(100) | Trimmed, valid email |
| Phone | NVARCHAR(20) | String, preserve `+` and leading zeroes |
| Department | NVARCHAR(50) | Trimmed, required |
| CreatedDate | DATETIME | Database-generated UTC, immutable |

Proposed application rules beyond the PDF: all input fields are required and email is unique after normalization to lowercase. The assignment does not specify nullability or uniqueness; document these as design choices, not original requirements. Phone accepts international formatting, with 7–15 digits after removing spaces, parentheses, hyphens, and the optional leading plus. Limit the original stored value to 20 characters. Department is free text rather than an invented fixed list.

```sql
CREATE TABLE dbo.Students (
    StudentId INT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_Students PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) NOT NULL,
    Phone NVARCHAR(20) NOT NULL,
    Department NVARCHAR(50) NOT NULL,
    CreatedDate DATETIME NOT NULL
        CONSTRAINT DF_Students_CreatedDate DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_Students_Email UNIQUE (Email)
);
```

Use `DATETIME` here to preserve the requested type, even though `DATETIME2` is suitable for newly designed schemas. Configure the SQL driver to interpret these values as UTC and serialize API timestamps with `Z`.

### Supporting authentication tables

`Users`: `UserId INT IDENTITY PRIMARY KEY`, normalized `Email NVARCHAR(100) UNIQUE NOT NULL`, `PasswordHash NVARCHAR(255) NOT NULL`, `IsActive BIT NOT NULL DEFAULT 1`, `CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()`.

`Sessions`: `TokenHash CHAR(64) PRIMARY KEY`, `UserId INT NOT NULL` referencing Users with cascading deletion, `CreatedAt DATETIME2 NOT NULL`, `ExpiresAt DATETIME2 NOT NULL`. Index `ExpiresAt`. Store the SHA-256 hash of a random session token, never the raw cookie value. SHA-256 is appropriate for a high-entropy token, not for passwords.

Create versioned SQL migration files and a small migration runner that records successful versions in `SchemaMigrations`. Apply migrations transactionally where supported. Use a separate migration credential; the runtime database user gets CRUD rights on Students and Sessions and SELECT on Users, with no schema-altering permissions. User provisioning uses an operator credential.

Seed a few synthetic students once. Never reset records or overwrite passwords automatically on application startup. Keep development/test databases separate from the shared review database.

## 4. Authentication and security requirements

1. Create reviewer accounts through a local operator script with a hidden password prompt. Prefer an account per reviewer; support one shared temporary review account if needed. No registration screen.
2. Hash passwords with Argon2id (at least 19 MiB memory, two iterations, parallelism one). Allow long passphrases; use a 15-character minimum for provisioned accounts and a reasonable maximum such as 128 characters. Never truncate silently. Benchmark on the free service.
3. On login, validate input, verify the hash, and return the same generic invalid-credentials response for unknown users and wrong passwords. Perform a dummy hash verification for unknown users.
4. Generate a fresh 32-byte cryptographically random token after successful login. Save only its hash and an eight-hour absolute expiry in SQL.
5. Set a production `__Host-session` cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and no Domain. Use a separate local-development cookie name on HTTP. Do not store auth tokens in localStorage.
6. For every protected API call, hash the cookie, load an unexpired session and active user, and reject otherwise. Protect every student endpoint server-side; React redirects alone are insufficient.
7. Logout deletes the session and clears the cookie. Password rotation revokes that user's sessions. Remove expired sessions opportunistically in a bounded cleanup operation; a paid scheduler is unnecessary.
8. Require the exact configured Origin on all browser mutation requests, including login and logout. Reject missing/unapproved origins, accept JSON only, and keep GET routes read-only. SameSite is an additional CSRF defense, not the only one.
9. Rate-limit login attempts by normalized account and IP, for example five failures per 15 minutes per account plus a broader IP limit. Return 429 and retry guidance. Configure proxy trust to the actual Render topology so forged forwarded headers do not bypass limits. An in-memory limiter is acceptable for this single demo instance but resets on restart; document that limitation.
10. Bind every SQL input with explicit `mssql` types and sizes. Never interpolate user values, sort names, or IDs into SQL text. Map duplicate-key errors to 409 without revealing database internals.
11. Enforce server-side validation, a small JSON body limit (for example 16 KB), security headers, and a production content security policy compatible with the built React assets. Render text normally; no raw HTML insertion.
12. Use TLS with certificate verification for database connections (`encrypt: true`, `trustServerCertificate: false`). Store secrets only in ignored local environment files and the hosting secret settings. Never expose secrets through `VITE_*` variables.
13. Use a shared connection pool capped around five connections, bounded query/connection timeouts, centralized error handling, and graceful shutdown. Return a helpful 503 when the database is unavailable. Do not blindly retry writes after an ambiguous failure.
14. Return `Cache-Control: no-store` for auth and student responses. Log request IDs and errors without cookies, passwords, database connection strings, or full student payloads.

Password parameters follow the [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## 5. API contract

All routes use `/api`. All student routes require a valid session. Invalid or out-of-range SQL INT IDs return 400; missing records return 404.

| Method | Path | Behavior | Success |
| --- | --- | --- | --- |
| POST | /auth/login | Email/password; set session cookie | 200 with safe user object |
| GET | /auth/me | Check existing session | 200; otherwise 401 |
| POST | /auth/logout | Invalidate session; safe to repeat | 204 |
| GET | /students?page=1&pageSize=20 | Stable order by StudentId descending; max page size 100 | 200 with items, total, page, pageSize |
| GET | /students/:id | Read full record | 200 |
| POST | /students | Create from four input fields | 201 with created record and Location header |
| PUT | /students/:id | Replace four editable fields | 200 with updated record |
| DELETE | /students/:id | Permanently delete demo record | 204 |
| GET | /health | Minimal process health; no secrets | 200 |

Editable JSON shape:

```json
{"name":"Amina Khan","email":"amina@example.com","phone":"+971501234567","department":"Computer Science"}
```

Responses add `studentId` and `createdDate`. Reject client-supplied IDs/creation dates and unexpected fields. Use a consistent error object such as `{ "error": { "code": "VALIDATION_ERROR", "message": "Check the entered values", "fields": {} } }`. Statuses: 400 invalid input, 401 missing/expired authentication, 403 invalid origin, 404 missing resource, 409 duplicate email, 429 rate limit, 500 unexpected failure, 503 unavailable database.

Use SQL `OUTPUT INSERTED` for create/update responses. Check affected-row counts for update/delete. Updates use last-write-wins for this small shared demo; optimistic concurrency and audit history are out of scope.

## 6. Frontend behavior

- `/login`: labeled email and password fields, show/hide password, generic login errors, disabled submitting state. Use appropriate autocomplete attributes.
- `/students`: student table, Add Student, View/Edit/Delete actions, pagination, logout, empty/loading/error states.
- `/students/new`: reusable student form with length limits and field errors.
- `/students/:id`: full student details including ID and created date.
- `/students/:id/edit`: same form prefilled from the server.
- Delete: accessible confirmation naming the selected student; keep the row until the server confirms success.

On first load call `/api/auth/me`. On 401 return to login with a session-expired message. After mutations, reload affected server data so the UI reflects persisted state. Disable duplicate submission while a request is in progress. Preserve form contents on recoverable errors. Validate on client for convenience and on server for enforcement.

Use responsive layouts, visible focus, keyboard-accessible controls, associated labels, and an aria-live status area. Test mobile and desktop. Handle invalid IDs and page refresh on nested routes. Register API routes and API 404 handling before the React SPA fallback.

## 7. Proposed repository layout

```text
student-crud/
  client/
    src/
      components/StudentForm.jsx
      components/ProtectedRoute.jsx
      pages/{Login,Students,StudentDetails,StudentEditor}.jsx
      api.js
      App.jsx
      styles.css
  server/
    src/
      app.js
      index.js
      config.js
      db.js
      routes/{auth,students}.js
      queries/{users,sessions,students}.js
      middleware/{requireAuth,checkOrigin,errorHandler}.js
      validation.js
    scripts/{migrate,create-user,seed}.js
    test/
  database/migrations/
  e2e/
  .github/workflows/ci.yml
  .env.example
  .gitignore
  .nvmrc
  package.json
  package-lock.json
  README.md
  IMPLEMENTATION_GUIDE.md
```

Use npm workspaces and root commands for `dev`, `build`, `start`, `test`, `lint`, `db:migrate`, `db:seed`, and `user:create`. These are planned commands, not yet implemented. Keep code comments focused on decisions. Commit the lockfile and validate required environment variables at startup.

Environment template: `NODE_ENV`, `PORT`, `APP_ORIGIN`, `DB_SERVER`, `DB_PORT=1433`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. The migration/provisioning script takes a separate operator credential. A random opaque session design does not require a JWT secret or refresh-token machinery.

## 8. Mac database setup and its limitation

Observed: Apple Silicon (`arm64`), macOS 26.6.2, Homebrew, Node 26.0.0, npm 11.12.1. Docker and `sqlcmd` were not initially on PATH. Select an updated Node 24 LTS patch for the project rather than relying on the existing Node 26.0.0 installation; see [Node release information](https://nodejs.org/en/about/previous-releases).

Microsoft SQL Server has no native macOS server installation. Its Linux containers are supported on Intel/AMD x86-64 hosts; ARM emulation, including Rosetta/QEMU, is not supported. Admin access does not remove this CPU/platform restriction. See [Microsoft container support](https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-deployment?view=sql-server-ver17).

Recommended: run React/Express on the Mac and connect to a separate free Azure SQL development database. Install Microsoft's free client locally:

```sh
brew install sqlcmd
sqlcmd --version
```

This installs a **client, not a database service**. Connection cannot be verified until a server/database and credentials exist. Once provisioned, connect interactively without putting the password on the command line:

```sh
sqlcmd -S tcp:YOUR-SERVER.database.windows.net,1433 -d student_crud_dev -U YOUR-OPERATOR -Q "SELECT DB_NAME() AS DatabaseName, @@VERSION AS Version;"
```

Use the installed client's documented encryption options and retain certificate verification. Do not add certificate-trust bypasses to resolve connectivity errors. See [Microsoft installation instructions](https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-download-install?view=sql-server-ver17).

If a database must run physically on this Mac, an x86 SQL Server container under emulation is an experimental alternative, not a reliable supported setup. It needs a container runtime, more memory, and compatibility validation. Another option is an existing x86-64 Linux/Windows machine running SQL Server Developer edition for development/testing. Do not substitute another SQL engine silently. No local server has been installed as part of this guide.

## 9. Free hosting plan and limits

| Component | Planned service | Cost control |
| --- | --- | --- |
| React + Express | One Render Free web service | Select Free; no paid instances, disks, domains, or add-ons |
| SQL database | Azure SQL Database free offer | Explicit free allocation with AutoPause at quota; never BillOverUsage |
| Repository | GitHub Free | Start private; invite reviewers or publish source intentionally |
| Domain/TLS | Provider subdomain | Use included HTTPS URL |

Render free services sleep after 15 minutes idle and may take about a minute to start. Their local filesystem is ephemeral, so persist records and sessions in SQL. Reviewers should expect an initial wait. Free hosting is suitable for this demonstration, with no always-on guarantee. [Render free service documentation](https://render.com/docs/free).

Azure SQL currently provides 100,000 vCore-seconds and 32 GB data storage per eligible database per month. It requires an Azure account and an eligible subscription; account verification may be required. Explicitly select the free offer and **pause when free limits are exhausted**. Verify the portal estimates zero cost; do not proceed with a normal billable database or enable overage. This is a conditional zero-cost option, not a promise that every account can sign up without payment details. [Microsoft free-offer terms and setup](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-tier?view=azuresql).

Azure SQL is a managed SQL Server-family database supporting the T-SQL features in this task; it is not a self-hosted SQL Server instance. Disclose this in the README. If the evaluator demands the exact self-hosted product, use a supported x86 machine; the PDF does not specify a hosting product.

If Azure account requirements are unacceptable or the offer is unavailable, the free hosted SQL Server database requirement remains unresolved. Do not spend money or switch to PostgreSQL to hide that limitation. Continue local frontend/API work and choose a compatible existing host before deployment.

## 10. Deployment procedure

1. Create/use an eligible Azure account, select the explicit free database offer, and choose AutoPause on quota exhaustion. Confirm zero estimated database cost and no optional billable resources. Use separate development and demo databases within verified free eligibility.
2. Create the logical SQL server and database. Keep the operator account out of runtime settings. Add a firewall rule for the Mac's current public IP for setup.
3. Apply migrations, create the runtime user with limited grants, seed synthetic data, and provision reviewer accounts using hidden prompts. Verify a real SQL connection and CRUD before deployment.
4. Create a GitHub repository. Initially exclude the supplied employer PDF from publishing; a paraphrased task description is sufficient. Commit reviewed source, migration files, documentation, and lockfile. Ignore `.env*` except `.env.example`, database exports, logs, local credentials, dependencies, builds, and `tmp/`.
5. Connect the repository to one Render Free Node web service. Build: `npm ci --include=dev && npm run build`. Start: `npm start`. Bind Express to `0.0.0.0` and Render's provided `PORT`. Serve `client/dist` in production.
6. Set runtime environment variables in Render, with `APP_ORIGIN` equal to the generated HTTPS origin. Choose a current supported Node 24 patch and the same major locally and in CI.
7. Obtain the service's outbound IP ranges and allow them in the Azure SQL firewall. These ranges can be shared with other Render customers; database authentication and TLS remain essential. Do not open the database to all Internet addresses. [Render outbound IP guidance](https://render.com/docs/outbound-ip-addresses).
8. Run migrations from the Mac/operator process before deploying dependent code. Do not assume a paid pre-deploy hook or interactive shell is available on Free. Use additive migrations and keep the application compatible during upgrades.
9. Deploy, check `/api/health`, then run the authenticated end-to-end test against the real hosted database. Test a second browser/device and a cold start. Verify data and sessions survive an application restart.
10. Share the HTTPS URL and account username; transmit the temporary password separately through your chosen private channel. Never put credentials in a URL, repository, screenshot, README, or public issue. This guide does not send messages to the team.

Budget alerts help monitor costs but are not hard caps. Do not enable paid resources. Review current quotas before deployment; documented plans may change. If quotas are exhausted, the acceptable result is temporary unavailability, not paid overage.

For recovery, retain migration history and a secure data export before destructive schema changes. Roll back application code to the previous compatible commit; do not automatically reverse a destructive migration. Use synthetic demo records only.

## 11. Implementation sequence

| Phase | Work | Completion gate |
| --- | --- | --- |
| 1 | Resolve free SQL host/account; pin runtime; establish repo structure | Real encrypted SQL connection works |
| 2 | Student/auth migrations, operator scripts, synthetic seed | Repeatable setup; no committed secrets |
| 3 | Login/logout/session and security middleware | Unauthorized requests fail; logout revokes token |
| 4 | Parameterized student CRUD and validation | CRUD, duplicate-email, and missing-record tests pass |
| 5 | React login/list/detail/form/delete UX | Full workflow works on mobile and desktop |
| 6 | Integration tests, build, lint, documentation | Clean install and production build pass |
| 7 | GitHub push, free deployment, hosted checks | Team URL and provisioned credentials are ready |

## 12. Verification and definition of done

- Valid login succeeds; incorrect login fails generically; inactive users fail; rate limits return 429.
- Every student endpoint returns 401 without a valid session, including direct HTTP requests.
- Login rotates tokens; expired and logged-out tokens cannot be reused; password rotation invalidates sessions.
- Unapproved-origin mutation requests fail, including logout and login. Production cookie flags are correct.
- Create/read/update/delete work against actual SQL Server/Azure SQL, not just mocks. Refresh retains data.
- Names with Unicode and apostrophes work. SQL-injection payloads remain data. HTML payloads render as text.
- Required fields, invalid email, overlong values, invalid phone, invalid IDs, malformed JSON, duplicate email, and oversized bodies produce controlled errors.
- Two simultaneous creates with the same email yield one success and one conflict through the database constraint.
- CreatedDate and StudentId cannot be changed by clients. Missing updates/deletes return 404.
- Database interruption produces a safe recoverable error; details and credentials never reach users or logs.
- Playwright covers login -> create -> view -> edit -> delete -> logout using unique synthetic test data.
- Test against a dedicated test database. Never point automated cleanup at the shared demo database. Run integration tests on a supported x86 SQL Server CI container or designated Azure SQL test database, not ARM emulation.
- GitHub CI runs install, lint, build, and appropriate tests within the account's free allowances; do not enable paid Actions overage. Untrusted pull requests do not receive database/deployment secrets.
- Nested route refresh, keyboard navigation, narrow-screen layout, empty state, loading state, and cold-start behavior are checked.
- GitHub contains no secrets, raw credentials, real student data, or database dumps.
- README explains setup, environment variables, SQL migrations, account provisioning, API, test commands, free-host limitations, and the Azure SQL hosting choice.
- Final handover contains repository URL, HTTPS demo URL, privately provided credentials, and known limitations.

## 13. Current status and next dependency

Completed: source PDF review, Mac environment inspection, architecture and requirements guide, current hosting/support research. SQL client installation status is recorded separately in `SETUP_STATUS.md`.

Not yet implemented: app code, schema deployment, hosted database, reviewer accounts, GitHub repository, or deployed URL. The immediate external dependency is access to an eligible free SQL Server-compatible host; no paid service is authorized. A client installation alone does not satisfy that dependency.
