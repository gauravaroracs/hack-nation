create extension if not exists pgcrypto;

create table if not exists scientist_feedback (
  id uuid primary key default gen_random_uuid(),
  plan_id text,
  hypothesis text,
  experiment_domain text,
  experiment_type text,
  section text,
  original_text text,
  corrected_text text,
  user_note text,
  rating text,
  created_at timestamp with time zone default now()
);

create table if not exists generated_plans (
  id uuid primary key default gen_random_uuid(),
  hypothesis text,
  literature_qc jsonb,
  plan jsonb,
  created_at timestamp with time zone default now()
);
