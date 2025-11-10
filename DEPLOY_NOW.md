# 🚀 Deploy to GitHub Pages - Quick Steps

Your repo is already initialized on branch `v3`. Follow these steps:

## ✅ Step 1: Commit Your Latest Changes

```bash
cd /Users/krishna.poddar/Desktop/Rapido\ EDA/GIG/internal_tools_v1

# Add all changes
git add .

# Commit
git commit -m "Add GitHub Pages deployment configuration"

# Push to your current branch
git push
```

## ✅ Step 2: Merge to Main Branch (if not already on main)

```bash
# Check current branch
git branch

# If you're on v3, merge to main or rename v3 to main:

# Option A: Rename v3 to main
git branch -m v3 main
git push -f origin main

# Option B: Keep v3 and merge to main
git checkout main  # or git checkout -b main if main doesn't exist
git merge v3
git push origin main
```

## ✅ Step 3: Configure GitHub Pages Settings

1. **Go to**: https://github.com/krishna-rapido/internal_tools_v1 (or whatever your repo is named)
   
2. **Click** "Settings" tab

3. **Click** "Pages" in the left sidebar

4. **Under "Build and deployment"**:
   - **Source**: Select "GitHub Actions"
   
5. **Save** (GitHub will automatically detect the workflow)

## ✅ Step 4: Verify Deployment

1. **Go to** "Actions" tab in your repository
2. **Wait** for the "Deploy to GitHub Pages" workflow to complete (2-3 minutes)
3. **Look for** green checkmark ✓
4. **Visit**: `https://krishna-rapido.github.io/internal_tools_v1/`

---

## 🎯 Your Site Will Be At:

### https://krishna-rapido.github.io/internal_tools_v1/

---

## ⚠️ Important: Backend Must Be Hosted Separately

The frontend will be on GitHub Pages, but you need to host the backend elsewhere.

### Quick Backend Setup Options:

1. **Railway.app** (Free tier):
   ```bash
   cd backend
   # Create railway.json
   echo '{"build": {"builder": "NIXPACKS"}, "deploy": {"startCommand": "python main.py"}}' > railway.json
   # Deploy via Railway CLI or GitHub integration
   ```

2. **Render.com** (Free tier):
   - Create new "Web Service"
   - Connect your GitHub repo
   - Build command: `pip install -r requirements.txt`
   - Start command: `python main.py`
   - Environment: Python 3

3. **Heroku**:
   ```bash
   # Create Procfile
   echo "web: python main.py" > backend/Procfile
   # Deploy via Heroku CLI or GitHub integration
   ```

### Update Frontend to Use Deployed Backend:

Create `frontend/.env.production`:
```bash
VITE_API_BASE_URL=https://your-backend-url.com
```

---

## 🔄 Making Updates After Initial Deployment

```bash
# Make your changes
git add .
git commit -m "Your update message"
git push

# GitHub Actions will automatically rebuild and deploy!
# Wait 2-3 minutes, then refresh your browser
```

---

## ✨ Summary

1. ✅ Commit and push your code
2. ✅ Configure GitHub Pages to use "GitHub Actions"
3. ✅ Wait for workflow to complete
4. ✅ Visit `https://krishna-rapido.github.io/internal_tools_v1/`
5. ⚠️ Deploy backend separately and update `VITE_API_BASE_URL`

---

**Questions? Check** `DEPLOYMENT_GUIDE.md` for detailed troubleshooting.

