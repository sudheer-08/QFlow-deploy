const { createClient } = require('@supabase/supabase-js');

// This is your single Supabase connection — import this wherever you need DB access
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = supabase;
