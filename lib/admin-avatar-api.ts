import { AuthError, requireAdmin as defaultRequireAdmin } from "./auth";
import { storeAvatarFile } from "./avatar-storage";
import { prisma } from "./db";
import { BookingError } from "./validation";

type AvatarEvent = {
  id: string;
  avatarUrl: string | null;
};

export type AvatarDatabase = {
  event: {
    findUnique(args: { where: { id: string } }): Promise<AvatarEvent | null>;
    update(args: {
      where: { id: string };
      data: { avatarUrl: string | null };
    }): Promise<AvatarEvent & Record<string, unknown>>;
  };
};

type AvatarDeps = {
  database?: AvatarDatabase;
  requireAdmin?: (request: Request) => Promise<void>;
  storeAvatar?: (file: File, eventId: string) => Promise<{ url: string }>;
};

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export function createAdminAvatarHandlers(deps: AvatarDeps = {}) {
  const database = deps.database ?? (prisma as unknown as AvatarDatabase);
  const requireAdmin = deps.requireAdmin ?? defaultRequireAdmin;
  const storeAvatar = deps.storeAvatar ?? storeAvatarFile;

  return {
    async POST(request: Request, context: RouteContext): Promise<Response> {
      try {
        await requireAdmin(request);
        const { eventId } = await context.params;
        const event = await database.event.findUnique({ where: { id: eventId } });
        if (!event) {
          return Response.json({ code: "EVENT_NOT_FOUND", message: "Event not found." }, { status: 404 });
        }

        const form = await request.formData();
        const avatar = form.get("avatar");
        if (!(avatar instanceof File)) {
          throw new BookingError("INVALID_INPUT");
        }

        const stored = await storeAvatar(avatar, eventId);
        const updated = await database.event.update({
          where: { id: eventId },
          data: { avatarUrl: stored.url },
        });
        return Response.json(updated);
      } catch (error) {
        return avatarErrorResponse(error);
      }
    },

    async DELETE(request: Request, context: RouteContext): Promise<Response> {
      try {
        await requireAdmin(request);
        const { eventId } = await context.params;
        const event = await database.event.findUnique({ where: { id: eventId } });
        if (!event) {
          return Response.json({ code: "EVENT_NOT_FOUND", message: "Event not found." }, { status: 404 });
        }
        const updated = await database.event.update({
          where: { id: eventId },
          data: { avatarUrl: null },
        });
        return Response.json(updated);
      } catch (error) {
        return avatarErrorResponse(error);
      }
    },
  };
}

function avatarErrorResponse(error: unknown): Response {
  if (
    error instanceof AuthError ||
    (typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: unknown }).status === 401)
  ) {
    const status = error instanceof AuthError ? error.status : 401;
    const message = error instanceof Error ? error.message : "Unauthorized";
    return Response.json({ code: "UNAUTHORIZED", message }, { status });
  }
  if (error instanceof BookingError) {
    return Response.json({ code: error.code, message: error.message }, { status: 400 });
  }
  return Response.json({ code: "BOOKING_FAILED", message: "Request failed." }, { status: 500 });
}
