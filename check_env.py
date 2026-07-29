with open('backend/.env', 'r') as f:
    for line in f:
        if '=' in line:
            key = line.split('=')[0].strip()
            val = line.split('=')[1].strip().split('#')[0].strip().strip('"').strip("'")
            if 'KEY' not in key and 'SECRET' not in key and 'PASS' not in key and 'PASSWORD' not in key and 'TOKEN' not in key:
                print(key, '=', val)
            else:
                print(key, '= [HIDDEN]')
