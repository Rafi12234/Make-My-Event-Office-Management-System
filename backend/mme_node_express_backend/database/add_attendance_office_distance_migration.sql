USE make_my_event_office_management;

-- Adds MakeMyEvent office-geofence distance/inside-office fields to
-- attendances, computed server-side (Haversine) from the office coordinates
-- (23.776915, 90.411707), 20m radius. Additive — existing rows get NULL.
ALTER TABLE attendances
  ADD COLUMN sign_in_distance_from_office  DECIMAL(8,2) NULL AFTER sign_in_accuracy,
  ADD COLUMN sign_in_inside_office         BOOLEAN      NULL AFTER sign_in_distance_from_office,
  ADD COLUMN sign_out_distance_from_office DECIMAL(8,2) NULL AFTER sign_out_accuracy,
  ADD COLUMN sign_out_inside_office        BOOLEAN      NULL AFTER sign_out_distance_from_office;
