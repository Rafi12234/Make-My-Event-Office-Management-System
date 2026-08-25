USE make_my_event_office_management;

-- Removes the manual "Mark Complete" toggle feature from client_meetings.
-- Meeting completion is now inferred purely from real content (items/
-- discussion), same as everywhere else in the app — there is no more
-- separate manual employee toggle or its audit trail.
ALTER TABLE client_meetings DROP FOREIGN KEY fk_client_meetings_completed_by;
ALTER TABLE client_meetings DROP INDEX fk_client_meetings_completed_by;
ALTER TABLE client_meetings
  DROP COLUMN is_completed,
  DROP COLUMN completed_by,
  DROP COLUMN completed_at;
