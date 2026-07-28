INSERT INTO "Event" (id, title, speaker, "profileLink", date, venue, description, "isPublished", "createdAt", "updatedAt")
VALUES (
  'dr-xiao-jie-2026-08-04',
  '1V1 Booking with Dr. Xiao Jie',
  'Dr. Xiao Jie',
  'https://example.com/speakers/xiao-jie',
  '2026-08-03T16:00:00.000Z'::timestamp,
  'Yungu Campus / TBD',
  'One-on-one conversations and a Student Lunch Meeting.',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  speaker = EXCLUDED.speaker,
  "profileLink" = EXCLUDED."profileLink",
  date = EXCLUDED.date,
  venue = EXCLUDED.venue,
  description = EXCLUDED.description,
  "isPublished" = true,
  "updatedAt" = NOW();

DELETE FROM "Slot" WHERE "eventId" = 'dr-xiao-jie-2026-08-04';

INSERT INTO "Slot" ("id", "eventId", "displayOrder", "startTime", "endTime", "maxCapacity", "reservedCount", "type", "isLocked", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'dr-xiao-jie-2026-08-04', 0, '09:00', '09:45', 1, 0, 'ONE_ON_ONE'::"SlotType", false, NOW(), NOW()),
  (gen_random_uuid()::text, 'dr-xiao-jie-2026-08-04', 1, '09:55', '10:40', 1, 0, 'ONE_ON_ONE'::"SlotType", false, NOW(), NOW()),
  (gen_random_uuid()::text, 'dr-xiao-jie-2026-08-04', 2, '10:50', '11:20', 1, 0, 'ONE_ON_ONE'::"SlotType", false, NOW(), NOW()),
  (gen_random_uuid()::text, 'dr-xiao-jie-2026-08-04', 3, '13:15', '14:00', 1, 0, 'ONE_ON_ONE'::"SlotType", false, NOW(), NOW()),
  (gen_random_uuid()::text, 'dr-xiao-jie-2026-08-04', 4, '14:10', '14:55', 1, 0, 'ONE_ON_ONE'::"SlotType", false, NOW(), NOW()),
  (gen_random_uuid()::text, 'dr-xiao-jie-2026-08-04', 5, '15:05', '15:50', 1, 0, 'ONE_ON_ONE'::"SlotType", false, NOW(), NOW()),
  (gen_random_uuid()::text, 'dr-xiao-jie-2026-08-04', 6, '11:30', '13:15', 12, 0, 'GROUP'::"SlotType", false, NOW(), NOW());
