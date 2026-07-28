import { createBookingRouteHandlers } from "@/lib/bookings-api";

export const { POST, PATCH, DELETE } = createBookingRouteHandlers();
