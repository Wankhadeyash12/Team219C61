# CivicPulse

**See it. Report it. Resolve it.**

CivicPulse is a civic intelligence workspace for reporting local issues, tracking resolution, and giving city teams a live operational view. The current build includes a polished React/Vite citizen dashboard, interactive civic map surface, report wizard, MongoDB-ready Express API, JWT authentication, Socket.IO events, geospatial issue queries, and a development seed flow.

## Run locally

Prerequisites: Node.js 20+, npm, and MongoDB Community Server running locally.

```powershell
npm install
Copy-Item .env.example .env
npm run seed
npm run dev
```

Open `http://localhost:5173` for the client and `http://localhost:5000/api/health` for the API.

If MongoDB is installed as a Windows service:

```powershell
net start MongoDB
```

## Demo accounts

Seeded account passwords:

- `citizen@demo.com`
- `authority@demo.com` uses password `admin`
- `worker@demo.com`
- `admin@demo.com`

The citizen, field worker, and admin accounts use password `CivicPulse2026!`.

## Commands

- `npm run dev` starts the API and Vite client together.
- `npm run client` starts only the client.
- `npm run server` starts only the API.
- `npm run seed` creates demo users and MongoDB issue records.
- `npm run build` creates the production client bundle.

## Configuration

Copy `.env.example` to `.env`. `MONGODB_URI` defaults to `mongodb://127.0.0.1:27017/civicpulse`; replacing it with a MongoDB Atlas connection string requires no database code changes. `AI_PROVIDER` and `AI_API_KEY` are intentionally optional. Without a configured provider, the API returns an explicit unavailable response instead of claiming an AI result.

## Structure

```text
client/                 React + Vite interface
server/src/index.js     Express, Mongoose, Socket.IO API
server/src/seed.js      Development/demo data
.env.example            Local and Atlas-ready configuration template
```

## Current scope

The dashboard and report wizard are fully interactive in the browser, including report submission, new map markers, notification feedback, responsive navigation, and graceful visual states. The API provides the core auth, issue, nearby geospatial, confirmation, notification, and AI abstraction routes. Production image storage, provider-specific AI adapters, and authority/field-worker screens are the next expansion points; the API boundary is already separated so those additions do not require rewriting the client foundation.
