# Documentation

This directory contains supplementary documentation for the Affidavit Maker application.

## Available Guides

### [Render Persistent Disk Setup](RENDER_PERSISTENT_DISK.md)
**Step-by-step instructions for adding persistent storage to your Render.com deployment**

Learn how to:
- Create a 1GB (or larger) persistent disk on Render.com
- Attach the disk to your running Docker container
- Configure persistent PDF storage that survives deployments
- Monitor disk usage and troubleshoot common issues
- Migrate from ephemeral to persistent storage

Perfect for production deployments where PDFs need to persist across restarts and deployments.

### [API Key Security](API_KEY_SECURITY.md)
**Security best practices for managing API keys and secrets**

Covers security considerations for:
- Auth0 credentials
- OpenAI API keys
- Stripe API keys
- Session secrets
- Environment variable management

## Main Documentation

For general deployment instructions, see:
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Complete deployment guide for Render.com
- [README.md](../README.md) - Project overview and setup instructions

## Contributing

When adding new documentation:
1. Create descriptive `.md` files in this directory
2. Update this README with a link and brief description
3. Reference the doc from main DEPLOYMENT.md if relevant
4. Follow the existing format and style conventions
