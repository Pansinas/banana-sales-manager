# 🍌 Banana Sales Management

A modern web application for managing banana sales with real-time synchronization and PostgreSQL backend.

## 🚀 Quick Start

### Prerequisites
- [Vercel CLI](https://vercel.com/cli) installed: `npm i -g vercel`
- Vercel account and logged in: `vercel login`
- PostgreSQL database (recommended: [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres))

### Deployment

#### 1. Backend Deployment
```bash
cd backend
vercel --prod
```

#### 2. Frontend Deployment
```bash
# From project root
vercel --prod
```

### Environment Variables
Set these in your Vercel dashboard for the backend:
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: `production`
- `CORS_ORIGIN`: Your frontend URL

## 📁 Project Structure
```
banana-sales-management/
├── app.html                 # Main application
├── index.html              # Entry point
├── package.json            # Dependencies
├── vercel.json             # Frontend deployment config
├── .vercelignore          # Deployment exclusions
├── backend/               # Backend API server
│   ├── server.js          # Express server
│   ├── package.json       # Backend dependencies
│   └── vercel.json        # Backend deployment config
└── database/              # Database schema
    └── schema.sql         # PostgreSQL schema
```

### 🔧 Key Configuration Files

#### `vercel.json` (Frontend)
- Optimized for static site deployment
- Custom headers for security
- Proper routing configuration
- Performance optimizations

#### `backend/vercel.json` (Backend)
- Serverless function configuration
- Express.js compatibility
- Database connection handling
- CORS and security settings

#### `.vercelignore`
- Excludes unnecessary files from deployment
- Reduces bundle size
- Improves deployment speed

## Deployment Scripts

### Available NPM Scripts
```bash
npm run configure-vercel    # Validate all configurations
npm run deploy-vercel      # Automated full deployment
npm run validate-config    # Check deployment readiness
npm run backend           # Start backend locally
npm run install-all       # Install all dependencies
```

## Database Setup

### Option 1: Vercel Postgres (Recommended)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to Storage → Create Database
3. Select PostgreSQL
4. Copy the connection string
5. Add as `DATABASE_URL` environment variable

### Option 2: External PostgreSQL
- Use any PostgreSQL provider (AWS RDS, Railway, etc.)
- Ensure SSL is enabled for production
- Add connection string to environment variables

## Post-Deployment Checklist

### ✅ Verification Steps
1. **Backend Health Check**
   - Visit: `https://your-backend.vercel.app/api/health`
   - Should return: `{"status": "OK", "timestamp": "..."}`

2. **Frontend Accessibility**
   - Visit: `https://your-frontend.vercel.app`
   - Verify app loads correctly

3. **Database Connection**
   - Test sales data creation/retrieval
   - Check real-time updates

4. **WebSocket Functionality**
   - Verify real-time notifications
   - Test live data synchronization

### 🔍 Troubleshooting

#### Common Issues
1. **Database Connection Errors**
   - Verify `DATABASE_URL` format
   - Check database server accessibility
   - Ensure SSL is properly configured

2. **CORS Errors**
   - Update `CORS_ORIGIN` environment variable
   - Verify frontend URL is correct

3. **Function Timeout**
   - Check Vercel function limits
   - Optimize database queries
   - Consider upgrading Vercel plan

#### Debug Commands
```bash
# Check deployment status
vercel ls

# View function logs
vercel logs [deployment-url]

# Test local deployment
vercel dev
```

## Performance Optimization

### Frontend Optimizations
- Static file caching
- Gzip compression
- CDN distribution
- Image optimization

### Backend Optimizations
- Connection pooling
- Query optimization
- Caching strategies
- Serverless function warming

## Security Features

### Implemented Security
- HTTPS/WSS enforcement
- CORS protection
- Environment variable encryption
- SQL injection prevention
- XSS protection headers

### Additional Recommendations
- Enable Vercel's security headers
- Set up custom domains with SSL
- Configure rate limiting
- Implement authentication (if needed)

## Monitoring & Analytics

### Built-in Monitoring
- Vercel Analytics
- Function performance metrics
- Error tracking
- Usage statistics

### Custom Monitoring
- Database performance
- Real-time connection health
- Sales data accuracy
- User experience metrics

## Scaling Considerations

### Automatic Scaling
- Vercel handles traffic spikes automatically
- Serverless functions scale on demand
- Global CDN distribution

### Database Scaling
- Connection pooling for high traffic
- Read replicas for analytics
- Caching layer for frequent queries

## Support & Resources

### Documentation
- [Vercel Documentation](https://vercel.com/docs)
- [Node.js on Vercel](https://vercel.com/docs/functions/serverless-functions/runtimes/node-js)
- [PostgreSQL on Vercel](https://vercel.com/docs/storage/vercel-postgres)

### Community
- [Vercel Discord](https://vercel.com/discord)
- [GitHub Issues](https://github.com/vercel/vercel/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/vercel)

---

## 🚀 Ready to Deploy?

1. **Validate Configuration**: `npm run configure-vercel`
2. **Deploy Automatically**: `npm run deploy-vercel`
3. **Monitor Deployment**: Check Vercel dashboard
4. **Test Application**: Verify all functionality

Your Banana Sales Management application is now ready for production on Vercel! 🎉