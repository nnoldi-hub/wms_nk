-- Migration 027: Coordonate spațiale pentru locații depozit
-- Permite harta vizuală, heatmap și calculul traseului optim de picking.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS coord_x    SMALLINT,          -- coloana în gridul depozitului (0-based)
  ADD COLUMN IF NOT EXISTS coord_y    SMALLINT,          -- rândul în gridul depozitului (0-based)
  ADD COLUMN IF NOT EXISTS coord_z    SMALLINT DEFAULT 0, -- nivelul pe verticală (0=sol, 1=raft1, etc.)
  ADD COLUMN IF NOT EXISTS path_cost  SMALLINT DEFAULT 1; -- cost traversare (1=normal, 5=necesită stivuitor)

-- Index pentru căutare eficientă pe hartă
CREATE INDEX IF NOT EXISTS idx_locations_coords
  ON locations(coord_x, coord_y, coord_z)
  WHERE coord_x IS NOT NULL AND coord_y IS NOT NULL;

COMMENT ON COLUMN locations.coord_x    IS 'Coloana în gridul depozitului (0-based, stânga→dreapta)';
COMMENT ON COLUMN locations.coord_y    IS 'Rândul în gridul depozitului (0-based, față→spate)';
COMMENT ON COLUMN locations.coord_z    IS 'Nivelul vertical: 0=sol, 1=raft1, 2=raft2, etc.';
COMMENT ON COLUMN locations.path_cost  IS 'Cost traversare celulă (1=mers pe jos, 5=necesită stivuitor)';
