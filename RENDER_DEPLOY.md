# Deployment Guide - Render.com

This guide will help you deploy pumpd to Render.com.

## Prerequisites

1. **MongoDB Atlas account** - [Sign up free](https://cloud.mongodb.com)
2. **GitHub account** - Your code must be in a GitHub repository
3. **Render account** - [Sign up free](https://render.com)

## Step 1: Prepare Your MongoDB Database

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a cluster (free tier works)
3. Click **Connect** → **Drivers**
4. Copy your connection string (e.g., `mongodb+srv://username:password@cluster.mongodb.net/`)
5. **Important**: Make sure to replace `<password>` with your actual password

## Step 2: Migrate Exercise Data (One-time)

Before deploying, you need to load the exercise database:

```bash
# Make sure your .env has the MongoDB URI
npm run migrate
```

This loads 1,324 exercises (~140MB, takes 2-3 minutes).

## Step 3: Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Ready for Render deployment"

# Create a GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

## Step 4: Deploy to Render

1. Go to [render.com](https://render.com) and sign in
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Render will auto-detect the `render.yaml` configuration

## Step 5: Configure Environment Variables

In the Render dashboard, add these environment variables:

### Required Variables:

| Variable | Value | Example |
|----------|-------|---------|
| `MONGO_URI` | Your MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `RP_ID` | Your Render domain (without https://) | `pumpd.onrender.com` |
| `ORIGIN` | Full URL of your app | `https://pumpd.onrender.com` |
| `VAPID_SUBJECT` | Your domain or email | `mailto:you@example.com` or `https://pumpd.onrender.com` |

### Optional Variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGO_DB` | `pumpd` | Database name |
| `RP_NAME` | `pumpd` | Passkey relying party name |
| `SESSION_DAYS` | `90` | Session cookie duration |
| `ADMIN_UIDS` | _(none)_ | Comma-separated user IDs for admin access |
| `INVITE_ONLY` | `false` | Set to `true` to require invites |

## Step 6: Deploy

1. Click **Create Web Service**
2. Render will build and deploy your app (takes 5-10 minutes)
3. Once deployed, your app will be available at `https://your-app-name.onrender.com`

## Important Notes

### Free Tier Limitations
- Render's free tier spins down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds to wake up
- Consider upgrading to a paid plan for production use

### Passkeys & HTTPS
- Passkeys require HTTPS, which Render provides automatically
- Make sure `RP_ID` matches your Render domain (e.g., `your-app.onrender.com`)
- Make sure `ORIGIN` includes `https://` (e.g., `https://your-app.onrender.com`)

### Push Notifications
- Push notifications work automatically on Render
- VAPID keys are generated on first startup and persist
- Set `VAPID_SUBJECT` to your domain or email

### Database
- The app uses MongoDB for all data storage
- Make sure you've run `npm run migrate` to populate exercises
- Keep your MongoDB connection string secure

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json` files
- Review build logs in Render dashboard

### App Won't Start
- Verify `MONGO_URI` is correct
- Check that MongoDB cluster is running and accessible
- Review runtime logs in Render dashboard

### Passkeys Don't Work
- Verify `RP_ID` matches your domain (without `https://`)
- Verify `ORIGIN` includes `https://` and matches your domain
- Clear browser data and try again

### Push Notifications Don't Work
- Verify `VAPID_SUBJECT` is set to your domain or email
- Check browser console for errors
- Ensure you've granted notification permissions

## Updating Your App

To deploy updates:

```bash
git add .
git commit -m "Your update message"
git push
```

Render will automatically rebuild and redeploy your app.

## Support

- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [pumpd GitHub Issues](https://github.com/DuarteSantos8/pumpd/issues)
