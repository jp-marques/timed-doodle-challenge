# Development Workflow

## Setup Complete! ✅

Your project now has a proper development workflow with two branches:

- **`main`** → Production (auto-deploys to Vercel)
- **`development`** → Testing/Development (local testing)

## How It Works

### Environment Configuration
- **Local Development**: Connects to `http://localhost:3001` (your local server)
- **Production**: Connects to `https://timed-doodle-challenge.onrender.com` (your live server)

The app automatically detects if you're running locally (`npm run dev`) or in production and connects to the right server.

## Your Development Workflow

### 1. Daily Development
```bash
# Switch to development branch
git checkout development

# Make your changes to code
# ... edit files ...

# Test locally
npm run dev                    # Frontend (localhost:5173)
cd server && npm run dev       # Backend (localhost:3001)
```

### 2. Test Your Changes
- Open http://localhost:5173 in your browser
- Your frontend will connect to your local backend
- Test all features thoroughly
- Make sure everything works perfectly

### 3. Deploy to Production
When you're happy with your changes:

```bash
# Switch to main branch
git checkout main

# Merge development into main
git merge development

# Push to production
git push origin main
```

This will automatically deploy to your live site!

### 4. Back to Development
```bash
# Switch back to development for next feature
git checkout development
```

## Quick Commands

```bash
# Start local development environment
npm run dev                    # In root folder (frontend)
cd server && npm run dev       # In server folder (backend)

# Switch branches
git checkout development       # For development
git checkout main              # For production

# Deploy to production
git checkout main
git merge development
git push origin main
```

## Benefits

✅ **Safe Testing**: Test everything locally before going live
✅ **No Accidental Deployments**: Only `main` branch deploys to production  
✅ **Clean Workflow**: Clear separation between development and production
✅ **Automatic Environment Detection**: App knows which server to connect to

## Server Requirements

Make sure your local server is running on port 3001:
```bash
cd server
npm run dev
```

Your server already has CORS configured for local development (localhost:5173).

---

**Current Branch**: You are now on the `development` branch
**Ready to code**: Make changes, test locally, then merge to main when ready! 