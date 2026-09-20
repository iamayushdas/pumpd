# 🚀 Quick Deploy Guide

Simple deployment guide for pumpd gym tracker.

## First-Time Setup

### 1. Prerequisites
- **Node.js 22+**: [Download here](https://nodejs.org)
- **MongoDB Atlas account**: [Sign up free](https://cloud.mongodb.com)

### 2. Get MongoDB Connection String
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a cluster (free tier works)
3. Click **Connect** → **Drivers**
4. Copy your connection string (looks like `mongodb+srv://...`)

### 3. Run Setup

```bash
npm run setup
```

This will:
- Check Node.js version
- Install all dependencies
- Create `.env` file
- Create data directory

**Important:** Edit `.env` and add your MongoDB connection string:
```env
MONGO_URI=mongodb+srv://your-actual-connection-string
```

### 4. Migrate Exercise Data (First Time Only)

```bash
npm run migrate
```

Loads 1,324 exercises with images into MongoDB (~140MB, takes 2-3 minutes).

---

## Daily Usage

### Start the App

```bash
npm start
```

Access at: **http://localhost:5173**

Stop with: `Ctrl+C`

---

## Deployment Checklist

### Fresh Machine
```bash
# 1. Clone repo
git clone https://github.com/DuarteSantos8/pumpd
cd pumpd

# 2. Setup
npm run setup

# 3. Edit .env with your MongoDB URI

# 4. Migrate data (first time)
npm run migrate

# 5. Start
npm start
```

### Existing Setup
```bash
npm start
```

---

## Configuration

Edit `.env` for customization:

| Variable | Purpose | Default |
|----------|---------|---------|
| `MONGO_URI` | MongoDB connection string | **(required)** |
| `MONGO_DB` | Database name | `pumpd` |
| `WEB_PORT` | Frontend port | `5173` |
| `PORT` | API port | `3000` |
| `RP_ID` | Passkey domain | `localhost` |
| `ORIGIN` | App URL | `http://localhost:5173` |
| `ADMIN_UIDS` | Admin user IDs | *(none)* |
| `INVITE_ONLY` | Require invites | `false` |

---

## Common Commands

```bash
npm run setup     # Initial setup
npm start         # Start app
npm run migrate   # Load exercise data
npm test          # Run tests
```

---

## Troubleshooting

### "MONGO_URI not configured"
Edit `.env` and add your MongoDB connection string.

### "Node.js not found"
Install Node.js 22+ from https://nodejs.org

### Port already in use
Edit `.env` and change `WEB_PORT` or `PORT`.

### Migration fails
- Check MongoDB connection string
- Ensure cluster is running
- Check network firewall settings

---

## Production Deployment

For production with HTTPS and passkeys, see: [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)

---

## Support

- [Q&A Discussions](https://github.com/DuarteSantos8/pumpd/discussions)
- [Issues](https://github.com/DuarteSantos8/pumpd/issues)
