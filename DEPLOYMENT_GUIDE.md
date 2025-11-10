# 🚀 GitHub Pages Deployment Guide

## Step-by-Step Instructions to Deploy to krishna-rapido.github.io

### Prerequisites
- Git installed on your machine
- GitHub account (username: krishna-rapido)
- Code ready to deploy

---

## 📝 Step 1: Initialize Git Repository (if not already done)

```bash
cd /Users/krishna.poddar/Desktop/Rapido\ EDA/GIG/internal_tools_v1

# Initialize git if not already initialized
git init

# Create .gitignore file
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
backend/.venv/
backend/venv/
*.egg-info/
dist/
build/
.pytest_cache/

# Node
frontend/node_modules/
frontend/dist/
frontend/.vite/
*.log

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
EOF

# Stage all files
git add .

# Create initial commit
git commit -m "Initial commit: Ladoo Metrics Analytics Platform"
```

---

## 🌐 Step 2: Create GitHub Repository

1. **Go to GitHub**: https://github.com/krishna-rapido
2. **Click** "New repository" (green button)
3. **Repository name**: `internal_tools_v1`
4. **Description**: "Captain Analytics Platform with Cohort Analysis, Funnel Metrics, and Report Builder"
5. **Visibility**: Choose **Public** (required for GitHub Pages on free tier)
6. **DO NOT** initialize with README (you already have one)
7. **Click** "Create repository"

---

## 🔗 Step 3: Link Local Repository to GitHub

```bash
# Add the remote repository
git remote add origin https://github.com/krishna-rapido/internal_tools_v1.git

# Verify the remote was added
git remote -v

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## ⚙️ Step 4: Configure GitHub Pages

### Option A: Using GitHub Actions (Recommended - Already Configured)

1. **Go to your repository**: https://github.com/krishna-rapido/internal_tools_v1
2. **Click** "Settings" tab
3. **Click** "Pages" in the left sidebar
4. **Under "Build and deployment"**:
   - Source: Select **"GitHub Actions"**
5. **Save** (the workflow will run automatically on next push)

### Option B: Using gh-pages branch (Manual Deployment)

If you prefer manual deployment:

```bash
# From the project root
cd frontend

# Deploy to gh-pages branch
npm run deploy
```

Then:
1. Go to repository Settings → Pages
2. Source: Select **"Deploy from a branch"**
3. Branch: Select **"gh-pages"** and **"/ (root)"**
4. Click Save

---

## 🎯 Step 5: Verify Deployment

### Check GitHub Actions (if using Option A):

1. Go to your repository
2. Click **"Actions"** tab
3. You should see "Deploy to GitHub Pages" workflow running
4. Wait for it to complete (green checkmark)
5. Your site will be live at: **https://krishna-rapido.github.io/internal_tools_v1/**

### Check Manual Deployment (if using Option B):

1. After running `npm run deploy`
2. Wait 1-2 minutes for GitHub Pages to build
3. Visit: **https://krishna-rapido.github.io/internal_tools_v1/**

---

## 🔄 Step 6: Making Updates

### For GitHub Actions (automatic):
```bash
# Make your changes
git add .
git commit -m "Description of changes"
git push

# The site will automatically rebuild and deploy
```

### For gh-pages (manual):
```bash
# Make your changes
git add .
git commit -m "Description of changes"
git push

# Then manually deploy
cd frontend
npm run deploy
```

---

## ⚠️ Important Notes

### API Backend Configuration

**GitHub Pages only hosts static files (frontend).** Your backend needs to be hosted separately.

Update the API base URL in `frontend/src/lib/api.ts`:

```typescript
// For development
const BASE_URL = 'http://localhost:8000';

// For production (update with your backend URL)
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://your-backend-url.com';
```

### Backend Hosting Options:

1. **Heroku** (easiest for Python/FastAPI)
2. **Railway.app** (free tier available)
3. **Render.com** (free tier available)
4. **AWS EC2** (more control)
5. **Google Cloud Run** (serverless)
6. **Vercel** (with serverless functions)

### CORS Configuration

Make sure your backend allows requests from GitHub Pages:

```python
# In backend/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://krishna-rapido.github.io",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🐛 Troubleshooting

### Issue: 404 Page Not Found

**Solution**: 
- Ensure you're using the correct URL: `https://krishna-rapido.github.io/internal_tools_v1/`
- Check that `base: '/internal_tools_v1/'` is set in `vite.config.ts`

### Issue: Blank Page

**Solution**:
- Check browser console for errors
- Verify `base` path matches repository name
- Check that all assets are loading correctly

### Issue: API Calls Failing

**Solution**:
- Frontend can't connect to `localhost:8000` from GitHub Pages
- Deploy backend to a hosting service
- Update `VITE_API_BASE_URL` environment variable

### Issue: GitHub Actions Failing

**Solution**:
- Check Actions tab for error logs
- Ensure `frontend/package-lock.json` is committed
- Verify all dependencies are in `package.json`

---

## 📊 Current Configuration

✅ **Vite Base Path**: `/internal_tools_v1/`  
✅ **GitHub Actions Workflow**: `.github/workflows/deploy.yml`  
✅ **Deploy Scripts**: Added to `package.json`  
✅ **gh-pages Package**: Installed  
✅ **.nojekyll File**: Created (prevents Jekyll processing)  

---

## 🎉 Expected Result

After successful deployment, your app will be available at:

**🔗 https://krishna-rapido.github.io/internal_tools_v1/**

---

## 📞 Quick Reference Commands

```bash
# Initialize and push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/krishna-rapido/internal_tools_v1.git
git branch -M main
git push -u origin main

# Manual deployment (if not using GitHub Actions)
cd frontend
npm run deploy

# Update and redeploy
git add .
git commit -m "Update message"
git push  # (automatic if using GitHub Actions)
cd frontend && npm run deploy  # (manual if using gh-pages)
```

---

**Note**: The backend must be hosted separately for full functionality. GitHub Pages only hosts the frontend static files.

