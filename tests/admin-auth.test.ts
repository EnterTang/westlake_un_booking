import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("signs and verifies an administrator session cookie", async () => {
  vi.stubEnv("SESSION_SECRET", "test-session-secret-at-least-32-chars");
  const { createAdminSessionValue, verifyAdminSessionValue } = await import("../lib/auth");

  const value = await createAdminSessionValue();
  expect(await verifyAdminSessionValue(value)).toBe(true);
  expect(await verifyAdminSessionValue("tampered." + value)).toBe(false);
});

test("requireAdmin rejects missing and invalid cookies", async () => {
  vi.stubEnv("SESSION_SECRET", "test-session-secret-at-least-32-chars");
  const { requireAdmin, createAdminSessionValue, ADMIN_COOKIE } = await import("../lib/auth");

  await expect(requireAdmin(new Request("http://localhost/api/admin/events"))).rejects.toMatchObject({
    status: 401,
  });

  const invalid = new Request("http://localhost/api/admin/events", {
    headers: { cookie: `${ADMIN_COOKIE}=not-a-valid-session` },
  });
  await expect(requireAdmin(invalid)).rejects.toMatchObject({ status: 401 });

  const token = await createAdminSessionValue();
  const valid = new Request("http://localhost/api/admin/events", {
    headers: { cookie: `${ADMIN_COOKIE}=${token}` },
  });
  await expect(requireAdmin(valid)).resolves.toBeUndefined();
});

test("login accepts only the configured admin password", async () => {
  vi.stubEnv("ADMIN_PASSWORD", "correct-horse-battery");
  vi.stubEnv("SESSION_SECRET", "test-session-secret-at-least-32-chars");
  const { verifyAdminPassword } = await import("../lib/auth");

  expect(verifyAdminPassword("correct-horse-battery")).toBe(true);
  expect(verifyAdminPassword("wrong-password")).toBe(false);
});
