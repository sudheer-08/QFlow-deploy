CREATE TYPE visit_type_enum AS ENUM ('new', 'followup', 'prescription', 'procedure', 'report_review');

ALTER TABLE bookings ADD COLUMN visit_type visit_type_enum DEFAULT 'new';

CREATE TABLE doctor_duration_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE,
  visit_type visit_type_enum NOT NULL,
  avg_duration_seconds integer NOT NULL DEFAULT 900,
  sample_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(doctor_id, visit_type)
);

ALTER TABLE doctor_duration_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctors read own stats" ON doctor_duration_stats
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "service role update stats" ON doctor_duration_stats
  FOR ALL USING (auth.role() = 'service_role');
