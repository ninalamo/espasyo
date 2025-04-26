# espasyo

### RUN JSON SERVER
No need when running the .net core web api project
json-server -p 3001 db.json


### RUN NEXT JS
npm run dev (local)

npm run build
npm run start (run build)


### Using JSON Server

```
if using json-server
NEXT_PUBLIC_API_URL=

if running local web api project
NEXT_PUBLIC_API_URL="http://localhost:5041/api"
```

```
username: admin@example.com
password: Admin@123
```

```
# Your public API base URL (used in browser + server) - env.local
NEXT_PUBLIC_API_URL="http://localhost:5041/api"

# NextAuth-specific configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=17CF4AC5-4DC6-4567-BCCE-BB6B668873B3
```