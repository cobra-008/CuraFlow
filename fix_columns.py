import psycopg

url = 'postgresql://postgres.bynfxwxswvezbevaspci:UwPpBkiLMbJj78aA@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

migrations = """
-- agent_registry missing columns
ALTER TABLE hospilot_app.agent_registry ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '';
ALTER TABLE hospilot_app.agent_registry ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#6366f1';

-- subagent_registry missing columns  
ALTER TABLE hospilot_app.subagent_registry ADD COLUMN IF NOT EXISTS capabilities text NOT NULL DEFAULT '';
ALTER TABLE hospilot_app.subagent_registry ADD COLUMN IF NOT EXISTS is_prefetch_eligible boolean NOT NULL DEFAULT false;
ALTER TABLE hospilot_app.subagent_registry ADD COLUMN IF NOT EXISTS agent_id text;

-- task_registry missing columns
ALTER TABLE hospilot_app.task_registry ADD COLUMN IF NOT EXISTS outputs jsonb NOT NULL DEFAULT '[]'::jsonb;
"""

with psycopg.connect(url, autocommit=True) as conn:
    conn.execute(migrations)
    
    # Verify
    with conn.cursor() as cur:
        for table in ['agent_registry', 'subagent_registry', 'task_registry']:
            cur.execute("""SELECT column_name FROM information_schema.columns 
                          WHERE table_schema='hospilot_app' AND table_name=%s 
                          ORDER BY ordinal_position""", (table,))
            cols = [c[0] for c in cur.fetchall()]
            print(f"{table}: {cols}")

print("Migration complete!")
