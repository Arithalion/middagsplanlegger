-- 004: Legg til teskje (tsk) og spiseskje (ss) i unit_type-enum

ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'tsk' AFTER 'l';
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'ss' AFTER 'tsk';
