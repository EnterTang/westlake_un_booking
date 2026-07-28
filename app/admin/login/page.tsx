import { loginAction } from "./actions";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <main className="admin-login">
      <form action={loginAction} className="admin-login-card">
        <h1>Administrator login</h1>
        <p>Enter the admin password to manage events and bookings.</p>
        {params.error ? <p className="form-error">Incorrect password.</p> : null}
        <label className="field">
          <span>Password</span>
          <input type="password" name="password" required autoComplete="current-password" />
        </label>
        <button type="submit" className="primary-button">
          Sign in
        </button>
      </form>
    </main>
  );
}
