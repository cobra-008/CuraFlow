import psycopg

url = 'postgresql://postgres.bynfxwxswvezbevaspci:UwPpBkiLMbJj78aA@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

with psycopg.connect(url) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='hospilot_app';")
        tables = cur.fetchall()
        print('Tables in hospilot_app:', tables)
