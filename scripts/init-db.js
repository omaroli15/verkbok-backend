# Verkbók backend

This repository contains a Node.js + Express backend for the Verkbók website and time tracking system.

## Features

- Authentication with JWT
- Company-level data model
- Document API for offers and invoices
- Job management
- Time tracking (clock in/out)
- Diary entries
- Time-off / sick leave requests
- Staff management

## Requirements

- Node.js 18+
- PostgreSQL 16+

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start PostgreSQL locally with Docker:
   ```bash
   docker-compose up -d db
   ```

3. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

5. Health check:
   ```bash
   curl http://localhost:5000/health
   ```

## Default database config

- Host: localhost
- Database: verkbok
- User: postgres
- Password: postgres

## Production deployment

This project is designed to be deployed to Render, Railway, Fly.io or any PostgreSQL-compatible host.

### Example environment for production

```env
PORT=10000
NODE_ENV=production
JWT_SECRET=your-strong-secret
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=verkbok
DB_USER=postgres
DB_PASSWORD=your-password
CLIENT_URL=https://your-frontend.example
```

## Main API routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/jobs`
- `POST /api/jobs`
- `GET /api/documents`
- `POST /api/documents`
- `GET /api/documents/:id`
- `PATCH /api/documents/:id`
- `DELETE /api/documents/:id`
- `GET /api/time`
- `POST /api/time/start`
- `POST /api/time/stop`
- `GET /api/diary`
- `POST /api/diary`
- `GET /api/timeoff`
- `POST /api/timeoff`
- `PATCH /api/timeoff/:id`
- `GET /api/staff`
- `POST /api/staff`

## Notes

The backend is ready to connect with the existing HTML frontend in your Verkbók project. Use the `Authorization: Bearer <token>` header on protected routes.
