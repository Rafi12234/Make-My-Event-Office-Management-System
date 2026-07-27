USE make_my_event_office_management;

-- Lets employees label each uploaded meeting image with a short tag
-- (e.g. "Stage", "Entry Gate") so images are easier to tell apart.
ALTER TABLE client_meeting_images
    ADD COLUMN tag_name VARCHAR(120) NULL AFTER original_file_name;
