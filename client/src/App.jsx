import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { api } from "./api";
const date = (value) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
function Alert({ error }) {
  return error ? (
    <div className="alert" role="alert">
      {error.message || error}
    </div>
  ) : null;
}
function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Loading your directory…
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const navigate = useNavigate();
  async function check() {
    setLoading(true);
    setError("");
    try {
      setUser((await api("/auth/me")).user);
    } catch (e) {
      if (e.status !== 401) setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    check();
    const expired = () => {
      setUser(null);
      navigate("/login");
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      setUser(null);
      navigate("/login");
    } catch (e) {
      setError(e.message);
    }
  }
  if (loading) return <Loading />;
  if (!user)
    return <Login onLogin={setUser} initialError={error} retry={check} />;
  return (
    <div className="app">
      <aside className="sidebar">
        <Link className="brand" to="/students">
          <span className="brand-icon">s.</span>
          <span>
            scholar<span className="brand-sub">STUDENT DIRECTORY</span>
          </span>
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <Link className="nav-item" to="/students">
          <span aria-hidden="true">▤</span> Students{" "}
          <span className="nav-dot" />
        </Link>
        <div className="sidebar-bottom">
          <span className="live-dot" /> Team workspace
          <p>
            A simple place to keep student
            <br />
            information up to date.
          </p>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> <strong>Students</strong>
          </span>
          <div className="account">
            <span className="avatar small">{user.email[0].toUpperCase()}</span>
            <span className="account-email">{user.email}</span>
            <button className="text-button" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <main className="content">
          <Alert error={error} />
          <Routes>
            <Route path="/students" element={<Students />} />
            <Route path="/students/new" element={<Editor />} />
            <Route path="/students/:id" element={<Details />} />
            <Route path="/students/:id/edit" element={<Editor />} />
            <Route path="*" element={<Navigate to="/students" replace />} />
          </Routes>
        </main>
        <footer>
          Student Directory <span>Built for clarity. Kept simple.</span>
        </footer>
      </div>
    </div>
  );
}
function Login({ onLogin, initialError, retry }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  const navigate = useNavigate();
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(data)),
      });
      onLogin(result.user);
      navigate("/students");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <section className="login-story">
        <div className="brand light">
          <span className="brand-icon">s.</span>
          <span>
            scholar<span className="brand-sub">STUDENT DIRECTORY</span>
          </span>
        </div>
        <div className="story-content">
          <span className="eyebrow">LESS ADMIN. MORE POSSIBILITY.</span>
          <h1>
            Every student.
            <br />
            One clear view.
          </h1>
          <p>
            A thoughtful workspace for your student records.
            <br />
            Organized, accessible, and ready for your team.
          </p>
          <div className="story-lines">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="story-footer">
          A little structure makes room for bigger things.
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="eyebrow">YOUR WORKSPACE AWAITS</span>
          <h2>Welcome back.</h2>
          <p className="muted">Sign in to manage your student directory.</p>
          <Alert error={error || initialError} />
          {initialError && (
            <button className="text-button" onClick={retry}>
              Retry connection
            </button>
          )}
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={100}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <div className="password-wrap">
                <input
                  name="password"
                  aria-label="Password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <button className="button primary full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to workspace"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <p className="access-note">
            Access is provided by your workspace administrator.
            <br />
            Contact them if you need an account.
          </p>
        </div>
        <span className="login-bottom">PRIVATE WORKSPACE · SECURE ACCESS</span>
      </section>
    </div>
  );
}
function Students() {
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await api(`/students?page=${page}`);
      if (!result.items.length && page > 1) {
        setPage(page - 1);
        return;
      }
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [page]);
  async function remove(student) {
    if (
      !window.confirm(
        `Delete ${student.name}? This permanently removes the student record.`,
      )
    )
      return;
    setError("");
    try {
      await api(`/students/${student.studentId}`, {
        method: "DELETE",
        body: "{}",
      });
      setNotice(`${student.name} was deleted.`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE DIRECTORY</span>
          <h1>
            Students<span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            Good records. A clearer picture of every student.
          </p>
        </div>
        <Link className="button primary" to="/students/new">
          <span aria-hidden="true">＋</span> Add student
        </Link>
      </div>
      <div className="overview">
        <div>
          <span className="stat-label">TOTAL STUDENTS</span>
          <strong>{data?.total ?? "—"}</strong>
          <span className="muted">in your directory</span>
        </div>
        <div className="overview-note">
          <span className="note-icon" aria-hidden="true">
            ↗
          </span>
          <p>
            A growing community.
            <br />
            <span className="muted">
              Keep the details that matter, all in one place.
            </span>
          </p>
        </div>
      </div>
      <Alert error={error} />
      <div className="notice" role="status">
        {notice}
      </div>
      <section className="table-card">
        <div className="table-heading">
          <div>
            <h2>
              All students <span className="count">{data?.total ?? 0}</span>
            </h2>
            <p>View and manage your student records.</p>
          </div>
          <button className="text-button" disabled={loading} onClick={load}>
            ↻ Refresh
          </button>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="empty">
            <p>We couldn’t load the directory.</p>
            <button className="button" onClick={load}>
              Try again
            </button>
          </div>
        ) : !data?.items.length ? (
          <div className="empty">
            <span className="empty-icon">▤</span>
            <h3>A fresh start for your directory</h3>
            <p>Add your first student to get things moving.</p>
            <Link className="button primary" to="/students/new">
              Add your first student
            </Link>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>DEPARTMENT</th>
                  <th>PHONE</th>
                  <th>ADDED</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.studentId}>
                    <td>
                      <Link
                        className="student-identity"
                        to={`/students/${s.studentId}`}
                      >
                        <span className="avatar">{initials(s.name)}</span>
                        <span>
                          <strong>{s.name}</strong>
                          <small>{s.email}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="pill">{s.department}</span>
                    </td>
                    <td className="nowrap">{s.phone}</td>
                    <td className="nowrap muted">{date(s.createdDate)}</td>
                    <td>
                      <div className="row-actions">
                        <Link
                          to={`/students/${s.studentId}/edit`}
                          aria-label={`Edit ${s.name}`}
                        >
                          Edit
                        </Link>
                        <button
                          aria-label={`Delete ${s.name}`}
                          onClick={() => remove(s)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            {data?.total
              ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, data.total)} of ${data.total} students`
              : "No records yet"}
          </span>
          <div>
            <button
              disabled={loading || page === 1}
              onClick={() => setPage(page - 1)}
            >
              ← Previous
            </button>
            <button
              disabled={loading || !data || page * 20 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null),
    [loading, setLoading] = useState(Boolean(id)),
    [error, setError] = useState(""),
    [fields, setFields] = useState({}),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (id) {
      setLoading(true);
      api(`/students/${id}`)
        .then((s) => {
          if (active) setStudent(s);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [id]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFields({});
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const saved = await api(id ? `/students/${id}` : "/students", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      navigate(`/students/${saved.studentId}`);
    } catch (e) {
      setError(e.message);
      setFields(e.fields || {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to="/students">
        ← Back to students
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">STUDENT RECORD</span>
          <h1>
            {id ? "Edit student" : "Add a student"}
            <span className="heading-dot">.</span>
          </h1>
          <p className="muted">
            {id
              ? "Keep their information up to date."
              : "A few details to bring someone new into the directory."}
          </p>
        </div>
      </div>
      <Alert error={error} />
      {loading ? (
        <Loading />
      ) : (
        (!id || student) && (
          <form className="form-card" onSubmit={submit}>
            <div className="form-section-heading">
              <span className="section-number">01</span>
              <div>
                <h2>Student information</h2>
                <p>All fields are required.</p>
              </div>
            </div>
            <div className="form-grid">
              {[
                ["name", "Full name", "text", 100, "e.g. Amina Khan"],
                [
                  "email",
                  "Email address",
                  "email",
                  100,
                  "e.g. amina@example.com",
                ],
                ["phone", "Phone number", "tel", 20, "e.g. +971 50 123 4567"],
                [
                  "department",
                  "Department",
                  "text",
                  50,
                  "e.g. Computer Science",
                ],
              ].map(([key, label, type, max, placeholder]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    type={type}
                    required
                    maxLength={max}
                    defaultValue={student?.[key] || ""}
                    placeholder={placeholder}
                    aria-invalid={Boolean(fields[key])}
                    aria-describedby={fields[key] ? `${key}-error` : undefined}
                  />
                  {fields[key] && (
                    <small className="field-error" id={`${key}-error`}>
                      {fields[key]}
                    </small>
                  )}
                </label>
              ))}
            </div>
            <div className="form-footer">
              <span className="muted">
                {id
                  ? "Student ID and creation date stay the same."
                  : "An ID and creation date are assigned automatically."}
              </span>
              <div>
                <Link className="button" to="/students">
                  Cancel
                </Link>
                <button className="button primary" disabled={busy}>
                  {busy ? "Saving…" : id ? "Save changes" : "Create student"}
                </button>
              </div>
            </div>
          </form>
        )
      )}
    </>
  );
}
function Details() {
  const { id } = useParams();
  const [student, setStudent] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setStudent(null);
    setError("");
    api(`/students/${id}`)
      .then((s) => {
        if (active) setStudent(s);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <>
      <Link className="back-link" to="/students">
        ← Back to students
      </Link>
      <Alert error={error} />
      {!student && !error ? (
        <Loading />
      ) : (
        student && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  STUDENT PROFILE · #{student.studentId}
                </span>
                <h1>{student.name}</h1>
                <p className="muted">
                  Part of your directory since {date(student.createdDate)}.
                </p>
              </div>
              <Link className="button primary" to={`/students/${id}/edit`}>
                Edit student
              </Link>
            </div>
            <section className="form-card detail-card">
              <span className="avatar large">{initials(student.name)}</span>
              <h2>Contact & academic details</h2>
              <dl>
                {[
                  ["Email address", student.email],
                  ["Phone number", student.phone],
                  ["Department", student.department],
                  ["Student ID", student.studentId],
                  ["Created date", date(student.createdDate)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )
      )}
    </>
  );
}
