import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { ADMIN_COOKIE, verifyAdminSessionValue } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logoutAction } from "./login/actions";

export default async function AdminPage() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token || !(await verifyAdminSessionValue(token))) {
    redirect("/admin/login");
  }

  const events = await prisma.event.findMany({
    orderBy: { date: "asc" },
    include: {
      slots: {
        orderBy: { displayOrder: "asc" },
        include: {
          bookings: {
            select: {
              id: true,
              userName: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  const serializable = events.map((event) => ({
    ...event,
    date: event.date.toISOString(),
    slots: event.slots.map((slot) => ({
      ...slot,
      bookings: slot.bookings.map((booking) => ({
        ...booking,
        createdAt: booking.createdAt.toISOString(),
      })),
    })),
  }));

  return (
    <main className="admin-page">
      <div className="admin-top">
        <div>
          <p className="speaker-kicker">Admin</p>
          <h1>Appointment console</h1>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="secondary-button admin-logout">
            Sign out
          </button>
        </form>
      </div>
      <AdminConsole initialEvents={serializable} />
    </main>
  );
}
