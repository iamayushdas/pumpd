# Local Development Setup

This project runs locally with Node.js and MongoDB Atlas.

## Prerequisites

- **Node.js** 22+ (for API and frontend)
- **MongoDB Atlas** (configured in `.env`)

## Quick Start

### 1. Install Dependencies

Frontend:
```bash
cd frontend && npm install
```

API:
```bash
cd api && npm install
```

### 2. Environment Variables

Your `.env` in the project root:

```env
RP_ID=localhost
ORIGIN=http://localhost:5173
WEB_PORT=5173
RP_NAME=pumpd
MONGO_URI=mongodb+srv://ayush24das_db_user:sQwS5IgaSkclslzj@pumpd.id0bblb.mongodb.net/?appName=pumpd
MONGO_DB=pumpd
DATA_DIR=./data
```

### 3. Migrate Exercise Dataset & Media to MongoDB (One-time)

If you need to re-sync exercises, images, and GIFs to MongoDB:
```bash
cd api && node migrate-exercises.js
```

### 4. Start Development Environment

Run the dev script:
```bash
./dev.sh
```

This starts:
- **API Server & Media** on `http://localhost:3000` (serves Auth, Data, Exercise JSON, JPG images, and animated GIFs from MongoDB)
- **Frontend Dev Server** on `http://localhost:5173` (Vite)

### 5. Access the App

Open **http://localhost:5173** in your browser.

## Database Collections

All app and exercise data is stored in MongoDB:
- `users` — user profiles
- `credentials` — WebAuthn passkeys
- `userStates` — workouts, routines, bodyweight history, and settings
- `subscriptions` — push notification subscriptions
- `invites` — registration invite codes
- `exercises` — 1,324 exercise JSON documents with full metadata
- `exercise_media` — 2,648 exercise image (JPG) and video (GIF) binary files

## Testing

Run frontend tests:
```bash
cd frontend && npm test
```
