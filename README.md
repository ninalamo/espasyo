# Espasyo - Crime Data Analysis System

A full-stack crime data analysis application with ASP.NET Core Web API backend and Next.js frontend.

## Prerequisites

- **Node.js** (version 18 or higher)
- **.NET 8 SDK** or higher
- **Docker Desktop** (for SQL Server)
- **Git**

## Backend Setup (ASP.NET Core Web API)

### 1. Download and Setup the Web API

```bash
# Clone the backend repository
git clone https://github.com/your-username/nin-architecture.git
cd nin-architecture
```

### 2. Start SQL Server Container

```bash
# Run SQL Server in Docker (required for the API)
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong!Passw0rd" -p 1433:1433 --name sqlserver -d mcr.microsoft.com/mssql/server:latest
```

### 3. Build and Run the Web API

```bash
# Navigate to the Web API project
cd espasyo.WebAPI

# Restore packages and build
dotnet restore
dotnet build

# Run the API (will automatically apply migrations and seed admin user)
dotnet run
```

The API will be available at:
- **HTTP**: http://localhost:5041
- **Swagger UI**: http://localhost:5041/swagger/index.html

### 4. Verify Backend Setup

- Visit http://localhost:5041/swagger/index.html
- The API should show available endpoints
- Admin user is auto-created: `admin@example.com` / `Admin@123`

## Frontend Setup (Next.js)

### 1. Install Dependencies

```bash
# Navigate to the Next.js app directory
cd nextjs-auth-app

# Install dependencies
npm install
```

### 2. Environment Configuration

Create a `.env.local` file in the `nextjs-auth-app` directory:

```bash
# .env.local
NEXT_PUBLIC_API_URL="http://127.0.0.1:5041/api"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="17CF4AC5-4DC6-4567-BCCE-BB6B668873B3"
```

### 3. Run the Frontend

```bash
# Development server
npm run dev

# Production build (optional)
npm run build
npm run start
```

The frontend will be available at: http://localhost:3000

## Usage

### Login Credentials

```
Email: admin@example.com
Password: Admin@123
```

### Running the Complete System

1. **Start SQL Server container** (if not already running)
2. **Run the ASP.NET Web API** (`dotnet run` in `espasyo.WebAPI`)
3. **Run the Next.js frontend** (`npm run dev` in `nextjs-auth-app`)
4. **Navigate to** http://localhost:3000/login
5. **Log in** with the admin credentials above

## Features

- 🔐 **JWT Authentication** with NextAuth.js
- 📊 **Crime Data Analysis** and visualization
- 🗺️ **Interactive Maps** with Leaflet
- 📈 **Charts and Analytics** with Chart.js
- 🔍 **Data Filtering** and search functionality
- 📱 **Responsive Design** with Tailwind CSS

## API Endpoints

- `POST /api/user` - User authentication
- `GET /api/incident` - Fetch incidents
- `POST /api/incident` - Create incident
- `GET /api/street` - Fetch streets

See Swagger UI at http://localhost:5041/swagger for complete API documentation.

## Troubleshooting

### Backend Issues

- **SQL Server connection failed**: Ensure Docker container is running on port 1433
- **Migration errors**: Delete the container and recreate: `docker rm -f sqlserver` then run the container command again
- **Port 5041 in use**: Stop other applications using this port or change the port in `launchSettings.json`

### Frontend Issues

- **Login fails**: Verify the Web API is running and accessible at http://localhost:5041
- **Environment variables not loaded**: Restart the Next.js dev server after creating/modifying `.env.local`
- **CORS errors**: Ensure the Web API CORS policy allows requests from localhost:3000

### Development Notes

- The system uses **Clean Architecture** principles in the backend
- **Entity Framework Core** with Code First migrations
- **NextAuth.js** for frontend authentication
- **Tailwind CSS** for styling
- **TypeScript** for type safety
