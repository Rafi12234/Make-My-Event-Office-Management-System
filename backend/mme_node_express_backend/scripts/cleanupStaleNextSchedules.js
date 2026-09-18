// One-time data-repair script: backfills `expectedCallDatetime`/
// `expectedMeetingDatetime` and deletes stale `ClientNextCall`/
// `ClientNextMeeting` rows left behind by calls/meetings logged BEFORE the
// createCall/createMeeting cleanup (see callsController.js/meetingsController.js)
// existed — those calls never got a chance to snapshot+delete the pending
// follow-up that they actually fulfilled, so the admin calendar wrongly
// still shows that old schedule as a separate "Missed" due item alongside
// the real completed call/meeting on the same day.
//
// Idempotent — safe to re-run; it only touches rows that are still stale
// (a newer call/meeting for the same client already exists after the one
// that scheduled the follow-up).
import "dotenv/config";
import { prisma } from "../src/config/prisma.js";

async function cleanupCalls() {
  const calls = await prisma.clientCall.findMany({
    select: { id: true, linkedRowKey: true, callDatetime: true, expectedCallDatetime: true, nextCall: { select: { id: true, nextCallDatetime: true } } },
    orderBy: [{ linkedRowKey: "asc" }, { callDatetime: "asc" }, { id: "asc" }],
  });

  const byRowKey = new Map();
  for (const c of calls) {
    if (!byRowKey.has(c.linkedRowKey)) byRowKey.set(c.linkedRowKey, []);
    byRowKey.get(c.linkedRowKey).push(c);
  }

  let backfilled = 0;
  let deleted = 0;

  for (const group of byRowKey.values()) {
    // Every call except the LAST one is, by definition, superseded by a
    // later call — so any next-call schedule it set is stale.
    for (let i = 0; i < group.length - 1; i++) {
      const stale = group[i].nextCall;
      if (!stale) continue;
      const fulfilling = group[i + 1];

      if (fulfilling.expectedCallDatetime === null) {
        await prisma.clientCall.update({
          where: { id: fulfilling.id },
          data: { expectedCallDatetime: stale.nextCallDatetime },
        });
        fulfilling.expectedCallDatetime = stale.nextCallDatetime; // keep local copy in sync
        backfilled++;
      }

      await prisma.clientNextCall.delete({ where: { id: stale.id } });
      deleted++;
    }
  }

  console.log(`Calls: backfilled expectedCallDatetime on ${backfilled} row(s), deleted ${deleted} stale ClientNextCall row(s).`);
}

async function cleanupMeetings() {
  const meetings = await prisma.clientMeeting.findMany({
    select: { id: true, linkedRowKey: true, meetingDatetime: true, expectedMeetingDatetime: true, nextMeeting: { select: { id: true, nextMeetingDatetime: true } } },
    orderBy: [{ linkedRowKey: "asc" }, { meetingDatetime: "asc" }, { id: "asc" }],
  });

  const byRowKey = new Map();
  for (const m of meetings) {
    if (!byRowKey.has(m.linkedRowKey)) byRowKey.set(m.linkedRowKey, []);
    byRowKey.get(m.linkedRowKey).push(m);
  }

  let backfilled = 0;
  let deleted = 0;

  for (const group of byRowKey.values()) {
    for (let i = 0; i < group.length - 1; i++) {
      const stale = group[i].nextMeeting;
      if (!stale) continue;
      const fulfilling = group[i + 1];

      if (fulfilling.expectedMeetingDatetime === null) {
        await prisma.clientMeeting.update({
          where: { id: fulfilling.id },
          data: { expectedMeetingDatetime: stale.nextMeetingDatetime },
        });
        fulfilling.expectedMeetingDatetime = stale.nextMeetingDatetime;
        backfilled++;
      }

      await prisma.clientNextMeeting.delete({ where: { id: stale.id } });
      deleted++;
    }
  }

  console.log(`Meetings: backfilled expectedMeetingDatetime on ${backfilled} row(s), deleted ${deleted} stale ClientNextMeeting row(s).`);
}

await cleanupCalls();
await cleanupMeetings();
process.exit(0);
