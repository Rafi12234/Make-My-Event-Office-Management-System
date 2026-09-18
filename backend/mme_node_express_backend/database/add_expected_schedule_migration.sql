USE make_my_event_office_management;

-- Snapshots the next-call/next-meeting time a call/meeting fulfills, taken
-- right before that ClientNextCall/ClientNextMeeting row is deleted (see
-- callsController.createCall / meetingsController.createMeeting). Lets the
-- Admin Company Calendar show "done Xm early/late" instead of losing the
-- original due time once a follow-up is fulfilled.
ALTER TABLE client_calls
  ADD COLUMN expected_call_datetime DATETIME NULL AFTER call_datetime;

ALTER TABLE client_meetings
  ADD COLUMN expected_meeting_datetime DATETIME NULL AFTER meeting_datetime;
