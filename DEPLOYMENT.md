# 🚀 Deployment Guide

This guide explains how to set up automatic deployment for the Banana Sales Tracker application using GitHub Actions.

## 📋 Prerequisites

- GitHub repository with your code
- GitHub account with appropriate permissions
- Choose your deployment platform (GitHub Pages for frontend, cloud service for backend)

## 🌐 Frontend Deployment (GitHub Pages)

The frontend is automatically deployed to GitHub Pages when you push to the main branch.

### Setup Steps:

1. **Enable GitHub Pages in your repository:**
   - Go to your repository on GitHub
   - Navigate to Settings → Pages
   - Under "Source", select "GitHub Actions"

2. **Push your code:**
   ```bash
   git add .
   git commit -m "Add deployment configuration"
   git push origin main
   ```

3. **Access your deployed app:**
   - Your app will be available at: `https://yourusername.github.io/your-repo-name`
   - Check the Actions tab to monitor deployment progress

## 🖥️ Backend Deployment Options

### Option 1: Railway (Recommended)

1. **Create a Railway account** at [railway.app](https://railway.app)

2. **Add Railway token to GitHub secrets:**
   - Go to your repository Settings → Secrets and variables → Actions
   - Add a new secret named `RAILWAY_TOKEN`
   - Get your token from Railway dashboard

3. **Uncomment Railway deployment in `.github/workflows/deploy-backend.yml`**

4. **Add PostgreSQL service in Railway:**
   - Create a new PostgreSQL service in your Railway project
   - Note the connection details

### Option 2: Heroku

1. **Create a Heroku account** and install Heroku CLI

2. **Add Heroku secrets to GitHub:**
   - `HEROKU_API_KEY`: Your Heroku API key
   - Update the app name in the workflow file

3. **Uncomment Heroku deployment in `.github/workflows/deploy-backend.yml`**

4. **Add Heroku PostgreSQL addon:**
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

### Option 3: Render (Recommended for Production)

Render is an excellent platform for deploying full-stack applications with automatic deployments from GitHub.

#### Backend Deployment on Render:

1. **Create a Render account** at [render.com](https://render.com)

2. **Connect your GitHub repository:**
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select your repository

3. **Configure the web service:**
   ```
   Name: banana-sales-backend
   Environment: Node
   Build Command: cd backend && npm install
   Start Command: cd backend && npm start
   ```

4. **Set environment variables in Render dashboard:**
   ```env
   NODE_ENV=production
   PORT=10000
   DB_HOST=your-postgres-host
   DB_PORT=5432
   DB_NAME=banana_sales
   DB_USER=your-db-user
   DB_PASSWORD=your-db-password
   ```

5. **Create PostgreSQL database:**
   - Click "New +" → "PostgreSQL"
   - Name: `banana-sales-db`
   - Copy the connection details to your web service environment variables

6. **Deploy:**
   - Click "Create Web Service"
   - Render will automatically build and deploy your backend
   - Your API will be available at: `https://your-service-name.onrender.com`

#### Frontend Deployment on Render:

1. **Create a static site:**
   - Click "New +" → "Static Site"
   - Connect the same GitHub repository

2. **Configure the static site:**
   ```
   Name: banana-sales-frontend
   Build Command: # Leave empty (no build needed)
   Publish Directory: .
   ```

3. **Update API endpoint in app.html:**
   - Replace `localhost:3000` with your Render backend URL
   - Example: `https://banana-sales-backend.onrender.com`

4. **Deploy:**
   - Your frontend will be available at: `https://your-frontend-name.onrender.com`

#### Auto-Deploy Setup:

1. **Enable auto-deploy:**
   - In your Render service settings
   - Enable "Auto-Deploy" from GitHub
   - Choose the `main` branch

2. **Database initialization:**
   - Connect to your PostgreSQL database via Render dashboard
   - Run the schema setup:
   ```sql
   -- Copy and paste contents from database/schema.sql
   ```

### Option 4: Docker + Cloud Provider

1. **Add Docker Hub secrets:**
   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: Your Docker Hub password

2. **Uncomment Docker deployment in `.github/workflows/deploy-backend.yml`**

3. **Deploy to your preferred cloud provider** (AWS, GCP, Azure, etc.)

## 🔧 Environment Variables

Make sure to set these environment variables in your deployment platform:

```env
DB_HOST=your-database-host
DB_PORT=5432
DB_NAME=banana_sales
DB_USER=your-database-user
DB_PASSWORD=your-database-password
NODE_ENV=production
PORT=3000
```

## 🗄️ Database Setup

### For Production Deployment:

1. **Create a PostgreSQL database** on your chosen platform
2. **Run the schema setup:**
   ```bash
   psql -h your-host -U your-user -d banana_sales -f database/schema.sql
   ```
3. **Update your environment variables** with the database connection details

## 🔍 Monitoring Deployment

1. **Check GitHub Actions:**
   - Go to your repository → Actions tab
   - Monitor the deployment workflows

2. **View deployment logs:**
   - Click on any workflow run to see detailed logs
   - Check for any errors or warnings

## 🛠️ Troubleshooting

### Common Issues:

1. **GitHub Pages not working:**
   - Ensure GitHub Pages is enabled in repository settings
   - Check that the workflow has proper permissions

2. **Backend deployment fails:**
   - Verify all required secrets are set
   - Check database connection details
   - Review deployment platform logs

3. **Database connection errors:**
   - Verify database credentials
   - Ensure database is accessible from your deployment platform
   - Check firewall settings

### Getting Help:

- Check the GitHub Actions logs for detailed error messages
- Review your deployment platform's documentation
- Ensure all environment variables are correctly set

## 🔄 Continuous Deployment

Once set up, your application will automatically deploy when you:

1. Push changes to the main branch
2. The GitHub Actions workflows will run automatically
3. Frontend deploys to GitHub Pages
4. Backend deploys to your chosen platform

Your application will be live and accessible to users!