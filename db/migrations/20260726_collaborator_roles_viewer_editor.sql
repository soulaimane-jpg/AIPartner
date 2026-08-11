-- Collapse the legacy three-role collaborator model (VIEWER/REVIEWER/APPROVER)
-- onto the two-role model (VIEWER/EDITOR). Both REVIEWER and APPROVER could
-- act on the SoW, so they both become EDITOR.
UPDATE "BriefCollaborator"
   SET "role" = 'EDITOR'
 WHERE "role" IN ('REVIEWER', 'APPROVER');

UPDATE "BriefAccess"
   SET "role" = 'EDITOR'
 WHERE "role" IN ('REVIEWER', 'APPROVER');
