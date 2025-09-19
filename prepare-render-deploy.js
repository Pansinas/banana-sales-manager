#!/usr/bin/env node

/**
 * Render Deployment Preparation Script
 * This script prepares your application for deployment on Render
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Preparing Banana Sales Manager for Render deployment...\n');

// Function to update API endpoint in app.html
function updateApiEndpoint() {
    const appHtmlPath = path.join(__dirname, 'app.html');
    
    if (!fs.existsSync(appHtmlPath)) {
        console.error('❌ app.html not found!');
        return false;
    }

    let content = fs.readFileSync(appHtmlPath, 'utf8');
    
    // Replace localhost with environment variable or default
    const apiEndpoint = process.env.RENDER_BACKEND_URL || 'https://banana-sales-backend.onrender.com';
    
    // Replace various localhost patterns
    content = content.replace(/localhost:3000/g, apiEndpoint.replace('https://', ''));
    content = content.replace(/http:\/\/localhost:3000/g, apiEndpoint);
    content = content.replace(/https:\/\/localhost:3000/g, apiEndpoint);
    
    fs.writeFileSync(appHtmlPath, content);
    console.log('✅ Updated API endpoint in app.html');
    return true;
}

// Function to validate package.json
function validatePackageJson() {
    const packagePath = path.join(__dirname, 'backend', 'package.json');
    
    if (!fs.existsSync(packagePath)) {
        console.error('❌ backend/package.json not found!');
        return false;
    }

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Check for required scripts
    if (!packageJson.scripts || !packageJson.scripts.start) {
        console.error('❌ Missing "start" script in package.json');
        return false;
    }

    console.log('✅ Package.json validation passed');
    return true;
}

// Function to check environment variables
function checkEnvironmentSetup() {
    console.log('\n📋 Environment Variables Checklist:');
    console.log('Make sure to set these in your Render dashboard:');
    console.log('- NODE_ENV=production');
    console.log('- PORT=10000');
    console.log('- DB_HOST (from PostgreSQL service)');
    console.log('- DB_PORT (from PostgreSQL service)');
    console.log('- DB_NAME (from PostgreSQL service)');
    console.log('- DB_USER (from PostgreSQL service)');
    console.log('- DB_PASSWORD (from PostgreSQL service)');
}

// Function to display deployment instructions
function displayInstructions() {
    console.log('\n🎯 Next Steps for Render Deployment:');
    console.log('1. Push your changes to GitHub:');
    console.log('   git add .');
    console.log('   git commit -m "Prepare for Render deployment"');
    console.log('   git push origin main');
    console.log('');
    console.log('2. Go to https://render.com and sign up/login');
    console.log('');
    console.log('3. Option A - Use render.yaml (Recommended):');
    console.log('   - Click "New +" → "Blueprint"');
    console.log('   - Connect your GitHub repository');
    console.log('   - Render will automatically detect render.yaml');
    console.log('');
    console.log('4. Option B - Manual setup:');
    console.log('   - Create PostgreSQL database first');
    console.log('   - Create Web Service for backend');
    console.log('   - Create Static Site for frontend');
    console.log('');
    console.log('5. Initialize database:');
    console.log('   - Connect to PostgreSQL via Render dashboard');
    console.log('   - Run the SQL from database/schema.sql');
    console.log('');
    console.log('🌟 Your app will be live at:');
    console.log('   Frontend: https://your-frontend-name.onrender.com');
    console.log('   Backend API: https://your-backend-name.onrender.com');
}

// Main execution
function main() {
    let success = true;
    
    // Run validations
    success = validatePackageJson() && success;
    
    // Update API endpoint if not in production
    if (process.env.NODE_ENV !== 'production') {
        success = updateApiEndpoint() && success;
    }
    
    if (success) {
        console.log('\n✅ All preparations completed successfully!');
        checkEnvironmentSetup();
        displayInstructions();
    } else {
        console.log('\n❌ Some preparations failed. Please fix the issues above.');
        process.exit(1);
    }
}

// Run the script
main();