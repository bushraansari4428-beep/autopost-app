import psycopg2, datetime

# Remove ?pgbouncer=true or any unknown parameters for psycopg2 DSN parser
db_url = "postgresql://postgres.swuwuzglxehiaogabmul:Pakistan887766551122@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("=== RECENT SYSTEM LOGS (LAST 15) ===")
cur.execute('SELECT "createdAt", level, message FROM "Log" ORDER BY "createdAt" DESC LIMIT 15;')
for row in cur.fetchall():
    print(f"[{row[0]}] [{row[1]}] {row[2]}")

print("\n=== RECENT UPLOAD HISTORY (LAST 5) ===")
cur.execute('SELECT "updatedAt", status, "facebookPostId", "errorMessage", "videoId" FROM "UploadHistory" ORDER BY "updatedAt" DESC LIMIT 5;')
for row in cur.fetchall():
    print(row)

print("\n=== MOST RECENT VIDEOS ADDED ===")
cur.execute('SELECT "createdAt", title, url, "sourceId" FROM "Video" ORDER BY "createdAt" DESC LIMIT 5;')
for row in cur.fetchall():
    print(row)

conn.close()
