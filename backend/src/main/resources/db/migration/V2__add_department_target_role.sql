-- Migration: multi-role support for DepartmentTarget
-- Run this BEFORE deploying the new backend code.
-- This is additive — existing data and old code are unaffected.

CREATE TABLE IF NOT EXISTS `DepartmentTargetRole` (
  `TargetID` int(11) NOT NULL,
  `RoleID`   int(11) NOT NULL,
  PRIMARY KEY (`TargetID`, `RoleID`),
  KEY `idx_dtr_role` (`RoleID`),
  CONSTRAINT `fk_dtr_target` FOREIGN KEY (`TargetID`)
      REFERENCES `DepartmentTarget` (`TargetID`) ON DELETE CASCADE,
  CONSTRAINT `fk_dtr_role` FOREIGN KEY (`RoleID`)
      REFERENCES `AMRole` (`RoleID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Backfill existing single RoleID values into the junction table
INSERT IGNORE INTO DepartmentTargetRole (TargetID, RoleID)
SELECT TargetID, RoleID FROM DepartmentTarget WHERE RoleID IS NOT NULL;
