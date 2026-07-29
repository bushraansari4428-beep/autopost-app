import os, json, urllib.request

env_vars = {}
with open('backend/.env', 'r') as f:
    for line in f:
        if '=' in line:
            key, val = line.strip().split('=', 1)
            env_vars[key] = val

supabase_url = env_vars.get('SUPABASE_URL')
supabase_key = env_vars.get('SUPABASE_SERVICE_KEY')

url = f"{supabase_url}/rest/v1/post_history?select=*&order=created_at.desc&limit=5"
req = urllib.request.Request(url, headers={
    'apikey': supabase_key,
    'Authorization': f'Bearer {supabase_key}'
})

try:
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode('utf-8'))
    for item in data:
        print(item['source_id'], item['video_id'], item['status'], item['created_at'])
except Exception as e:
    print('Error:', e)
