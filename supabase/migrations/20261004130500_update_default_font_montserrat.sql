-- Update default font family for new brands
ALTER TABLE brands ALTER COLUMN font_family SET DEFAULT 'Montserrat';

-- Update existing brands that might have used the old default
UPDATE brands SET font_family = 'Montserrat' WHERE font_family = 'System';
