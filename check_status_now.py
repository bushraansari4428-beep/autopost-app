import urllib.request, json

env_vars = {}
with open('backend/.env', 'r') as f:
    for line in f:
        if '=' in line and not line.strip().startswith('#'):
            key, val = line.strip().split('=', 1)
            env_vars[key] = val.strip().strip('"').strip("'")

supabase_url = env_vars.get('SUPABASE_URL')
supabase_key = env_vars.get('SUPABASE_SERVICE_KEY') or env_vars.get('SUPABASE_KEY')

def fetch_table(table_name):
    url = f"{supabase_url}/rest/v1/{table_name}?select=*&order=createdAt.desc&limit=10"
    req = urllib.request.Request(url, headers={
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}'
    })
    try:
        res = urllib.request.urlopen(req)
        data = json.loads(res.read().decode('utf-8'))
        print(f"\n--- LATEST {table_name.upper()} ---")
        for d in data[:5]:
            print(json.dumps(d, indent=2))
    except Exception as e:
        # try order=created_at.desc
        try:
            url2 = f"{supabase_url}/rest/v1/{table_name}?select=*&order=created_at.desc&limit=10"
            req2 = urllib.request.Request(url2, headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}'
            })
            res2 = urllib.request.urlopen(req2)
            data = json.loads(res2.read().decode('utf-8'))
            print(f"\n--- LATEST {table_name.upper()} ---")
            for d in data[:5]:
                print(json.dumps(d, indent=2))
        except Exception as e2:
            print(f"Error checking {table_name}: {e2}")

fetch_table('Log')
fetch_table('UploadHistory')
