# Vercel Environment Variables Setup Guide

## ⚠️ IMPORTANT: Configure Environment Variables

Your application has been updated and deployed, but you **MUST** add environment variables in Vercel for it to work properly.

## Required Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `MONGO_URI` | Your MongoDB connection string | MongoDB Atlas connection URI |
| `JWT_SECRET` | Your JWT secret key | Secret key for JWT token generation |
| `NODE_ENV` | `production` | Environment type |

---

## Steps to Add Environment Variables in Vercel

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Navigate to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Select your project: **holo_backend**

2. **Open Settings**
   - Click on the **Settings** tab at the top

3. **Navigate to Environment Variables**
   - In the left sidebar, click **Environment Variables**

4. **Add Each Variable**
   For each variable below, click **Add New**:

   **Variable 1:**
   - Name: `MONGO_URI`
   - Value: `mongodb+srv://ajeetkumarsahholo_db_user:YOUR_ACTUAL_PASSWORD@cluster0.qqinscn.mongodb.net/?appName=Cluster0`
   - Environments: Check ✅ **Production**, **Preview**, and **Development**
   - Click **Save**

   **Variable 2:**
   - Name: `JWT_SECRET`
   - Value: (copy from your local `.env` file)
   - Environments: Check ✅ **Production**, **Preview**, and **Development**
   - Click **Save**

   **Variable 3:**
   - Name: `NODE_ENV`
   - Value: `production`
   - Environments: Check ✅ **Production** only
   - Click **Save**

5. **Redeploy**
   - After adding all variables, go to **Deployments** tab
   - Click on the latest deployment
   - Click **Redeploy** → **Use existing Build Cache**

---

### Method 2: Via Vercel CLI (Alternative)

If you have Vercel CLI installed:

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Add environment variables
vercel env add MONGO_URI
# Paste your MongoDB URI when prompted

vercel env add JWT_SECRET
# Paste your JWT secret when prompted

vercel env add NODE_ENV
# Type: production

# Redeploy
vercel --prod
```

---

## After Adding Variables

1. **Check Deployment Status**
   - Go to **Deployments** tab in Vercel
   - Wait for the new deployment to complete (usually 1-2 minutes)

2. **Verify Deployment**
   - Visit: https://holo-backend.vercel.app/
   - You should see: "API is running..."

3. **Test API Endpoints**
   Use Postman or curl:
   ```bash
   # Test registration
   curl -X POST https://holo-backend.vercel.app/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "fullName": "Test User",
       "email": "test@example.com",
       "password": "testpassword123"
     }'
   ```

---

## MongoDB Atlas - Additional Configuration

Also ensure your MongoDB Atlas is configured correctly:

### 1. Network Access (IP Whitelist)
- Go to [MongoDB Atlas](https://cloud.mongodb.com/)
- Click **Network Access** (under Security)
- Add IP Address: `0.0.0.0/0` (allows all IPs - for serverless)
  - ⚠️ This is required for Vercel since it uses dynamic IPs

### 2. Database Access
- Click **Database Access** (under Security)
- Verify user `ajeetkumarsahholo_db_user` exists
- Ensure the password matches what you use in `MONGO_URI`

---

## Troubleshooting

If the deployment still doesn't work:

1. **Check Build Logs**
   - Go to Deployments → Click latest deployment
   - Check for any error messages

2. **Verify Environment Variables**
   - Settings → Environment Variables
   - Ensure all 3 variables are set correctly

3. **Check Function Logs**
   - Deployments → Click deployment → View Function Logs
   - Look for MongoDB connection errors

---

## What Was Changed

✅ Created `api/index.ts` - Serverless function entry point
✅ Updated `vercel.json` - Routes all requests to serverless function
✅ Updated `tsconfig.json` - Include api directory
✅ Created `.vercelignore` - Ignore unnecessary files
✅ Pushed to GitHub (commit: 56541ea)

**Next:** Configure environment variables in Vercel dashboard!
