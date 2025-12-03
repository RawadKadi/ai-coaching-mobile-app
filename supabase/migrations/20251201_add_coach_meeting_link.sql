/*
  # Add Meeting Link to Coaches Table

  1. Changes
    - Add `meeting_link` column to `coaches` table (text, nullable)
*/

ALTER TABLE coaches 
ADD COLUMN IF NOT EXISTS meeting_link text;
