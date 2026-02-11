-- Initialize the finance database
-- This script runs on first container startup

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE my_finance TO postgres;

-- Note: TypeORM will handle schema creation via synchronize (dev) or migrations (prod)
-- This file is for any additional database setup that needs to happen before the app starts
