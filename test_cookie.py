import requests

s = requests.Session()
r = s.get('http://localhost:8000/quiz/variation_aussprache/play')

print(f'Status: {r.status_code}')
print(f'Cookies: {list(s.cookies.keys())}')
print(f'Cookie values: {dict(s.cookies)}')

if 'quiz_session' in s.cookies:
    print('✅ quiz_session cookie WAS SET')
else:
    print('❌ quiz_session cookie NOT SET')
