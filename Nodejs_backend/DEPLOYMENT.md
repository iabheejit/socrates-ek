# Deployment Guide - Ekatra Backend

## Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose (for containerized deployment)
- Access to required services:
  - Airtable account with API access
  - Azure LLM endpoints
  - WATI WhatsApp Business API
  - Azure Blob Storage

## Environment Setup

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in all required environment variables in `.env`:**
   - Airtable credentials
   - WhatsApp (WATI) API keys
   - Azure LLM endpoints and keys
   - Azure Storage connection strings

3. **Verify environment variables:**
   The application will validate all required variables on startup and exit with helpful errors if any are missing.

## Local Development

### Installation

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Running the Server

```bash
# Start the server
npm start
```

The server will start on port 3000 (or the port specified in `.env`).

**Health check:** http://localhost:3000/health

## Docker Deployment

### Build and Run with Docker Compose

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Build Docker Image Manually

```bash
# Build production image
docker build -t ekatra-backend:latest .

# Run container
docker run -d \
  --name ekatra-backend \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  ekatra-backend:latest
```

## Production Deployment

### Pre-deployment Checklist

- [ ] All environment variables configured
- [ ] `.env` file secured (not committed to git)
- [ ] HTTPS configured (via reverse proxy like Nginx)
- [ ] CORS origins restricted to production domains
- [ ] Rate limiting configured appropriately
- [ ] Logging configured and monitored
- [ ] Health checks configured in load balancer
- [ ] Backup strategy for logs and critical data

### Environment Variables for Production

Add these to your `.env` file:

```bash
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
port=3000
```

### Using a Reverse Proxy (Nginx Example)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for long-running LLM requests
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

### PM2 Process Manager (Alternative to Docker)

```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start server.js --name ekatra-backend

# Configure auto-restart on system reboot
pm2 startup
pm2 save

# Monitor
pm2 monit

# View logs
pm2 logs ekatra-backend

# Restart
pm2 restart ekatra-backend
```

## Monitoring and Logging

### Log Files

Logs are stored in the `logs/` directory:
- `error.log` - Error-level logs only
- `combined.log` - All logs

### Health Check Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-22T10:00:00.000Z",
  "uptime": 12345.67
}
```

### Monitoring Recommendations

- Set up uptime monitoring (e.g., UptimeRobot, Pingdom)
- Monitor `/health` endpoint every 30 seconds
- Set up error tracking (Sentry, Rollbar)
- Monitor API rate limits and usage
- Track LLM API costs and quotas

## Scaling Considerations

### Horizontal Scaling

The application is stateless and can be horizontally scaled:

```yaml
# docker-compose.yml with multiple instances
services:
  ekatra-backend-1:
    # ... configuration
  ekatra-backend-2:
    # ... configuration
```

Use a load balancer (Nginx, HAProxy, or cloud load balancer) to distribute traffic.

### Database Connection Pooling

Consider implementing connection pooling for Airtable requests to improve performance under load.

### Caching

Consider adding Redis for caching:
- Student data
- Course content
- LLM responses (with TTL)

## Troubleshooting

### Application Won't Start

1. Check environment variables:
   ```bash
   npm start
   ```
   The app will show exactly which variables are missing.

2. Check port availability:
   ```bash
   lsof -i :3000
   ```

3. Check logs:
   ```bash
   tail -f logs/error.log
   ```

### High Memory Usage

- PDF generation creates buffers - monitor memory for high-volume certificate generation
- Consider implementing a job queue for batch operations

### Rate Limiting Issues

Adjust rate limits in `middleware/rateLimiter.js`:
- `apiLimiter` - General API requests
- `webhookLimiter` - WhatsApp webhooks
- `llmQueryLimiter` - LLM query operations

## Security

### Best Practices

1. **Never commit `.env` files** - Use secrets management
2. **Rotate API keys regularly**
3. **Monitor for suspicious activity** in logs
4. **Keep dependencies updated**: `npm audit fix`
5. **Use HTTPS** in production
6. **Restrict CORS origins** to known domains
7. **Review rate limits** based on usage patterns

### Security Headers

Consider adding security headers via Helmet.js:

```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

## Backup and Recovery

### What to Backup

- `.env` file (stored securely, not in git)
- `logs/` directory
- Custom fonts and assets
- Certificate templates

### Disaster Recovery

1. Keep `.env` file in secure password manager or secrets vault
2. Document all external service configurations
3. Test deployment process regularly
4. Keep Docker images versioned and tagged

## Performance Optimization

- Enable compression: `npm install compression`
- Implement response caching where appropriate
- Monitor and optimize slow Airtable queries
- Consider CDN for static assets (fonts, images)

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review GitHub Issues
- Contact development team
