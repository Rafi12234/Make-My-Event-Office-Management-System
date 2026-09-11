-- One-time data repair (run manually via phpMyAdmin — production has no
-- shell/node exec available). Mirrors scripts/cleanupStaleNextSchedules.js.
--
-- Backfills expected_call_datetime / expected_meeting_datetime on whichever
-- call/meeting actually fulfilled an older pending follow-up, then deletes
-- that now-stale client_next_calls / client_next_meetings row. Needed for
-- any call/meeting logged BEFORE the createCall/createMeeting cleanup logic
-- existed — those never got a chance to snapshot+delete the schedule they
-- fulfilled, so the admin calendar wrongly shows it as a separate "Missed"
-- due item alongside the real completed call/meeting on the same day.
--
-- Idempotent — safe to run more than once (nothing matches on a second run).

-- ── Calls ──────────────────────────────────────────────────────────

UPDATE client_calls fulfilling
JOIN (
  SELECT
    cnc.next_call_datetime,
    (
      SELECT c2.id FROM client_calls c2
      WHERE c2.linked_row_key = parent.linked_row_key
        AND (
          c2.call_datetime > parent.call_datetime
          OR (c2.call_datetime = parent.call_datetime AND c2.id > parent.id)
        )
      ORDER BY c2.call_datetime ASC, c2.id ASC
      LIMIT 1
    ) AS fulfilling_call_id
  FROM client_next_calls cnc
  JOIN client_calls parent ON parent.id = cnc.call_id
) AS stale ON stale.fulfilling_call_id = fulfilling.id
SET fulfilling.expected_call_datetime = stale.next_call_datetime
WHERE fulfilling.expected_call_datetime IS NULL;

DELETE cnc FROM client_next_calls cnc
JOIN client_calls parent ON parent.id = cnc.call_id
WHERE EXISTS (
  SELECT 1 FROM client_calls newer
  WHERE newer.linked_row_key = parent.linked_row_key
    AND (
      newer.call_datetime > parent.call_datetime
      OR (newer.call_datetime = parent.call_datetime AND newer.id > parent.id)
    )
);

-- ── Meetings (same pattern) ────────────────────────────────────────

UPDATE client_meetings fulfilling
JOIN (
  SELECT
    cnm.next_meeting_datetime,
    (
      SELECT m2.id FROM client_meetings m2
      WHERE m2.linked_row_key = parent.linked_row_key
        AND (
          m2.meeting_datetime > parent.meeting_datetime
          OR (m2.meeting_datetime = parent.meeting_datetime AND m2.id > parent.id)
        )
      ORDER BY m2.meeting_datetime ASC, m2.id ASC
      LIMIT 1
    ) AS fulfilling_meeting_id
  FROM client_next_meetings cnm
  JOIN client_meetings parent ON parent.id = cnm.meeting_id
) AS stale ON stale.fulfilling_meeting_id = fulfilling.id
SET fulfilling.expected_meeting_datetime = stale.next_meeting_datetime
WHERE fulfilling.expected_meeting_datetime IS NULL;

DELETE cnm FROM client_next_meetings cnm
JOIN client_meetings parent ON parent.id = cnm.meeting_id
WHERE EXISTS (
  SELECT 1 FROM client_meetings newer
  WHERE newer.linked_row_key = parent.linked_row_key
    AND (
      newer.meeting_datetime > parent.meeting_datetime
      OR (newer.meeting_datetime = parent.meeting_datetime AND newer.id > parent.id)
    )
);
