# Render.com Persistent Disk Setup Guide

This guide provides step-by-step instructions for creating and attaching a persistent disk to your running Affidavit Maker Docker container on Render.com. This will prevent PDF files from being deleted during deployments or restarts.

## Overview

By default, the Affidavit Maker application stores PDF files in the `/documents` directory, which uses **ephemeral storage**. This means:
- ❌ Files are deleted when you deploy or restart your service
- ❌ Files don't persist across container instances
- ✅ Acceptable for MVP where users download PDFs immediately

With a **persistent disk**, you get:
- ✅ Files persist across deployments and restarts
- ✅ Files are backed up regularly by Render
- ✅ Can store up to 1GB (or more) of PDF documents
- ✅ Better for production use

## Prerequisites

- Render.com account with an active web service
- Your Affidavit Maker application deployed and running
- Access to the Render dashboard

## Step-by-Step Instructions

### Step 1: Navigate to Your Web Service

1. Log in to your Render dashboard at https://dashboard.render.com
2. Click on your **affidavit-maker** web service (or whatever you named it)
3. You should see your service's overview page with tabs like Events, Logs, Metrics, etc.

### Step 2: Create a Persistent Disk

1. In the left sidebar, click on the **"Disks"** tab
   - If you don't see this tab, make sure your service is on a paid plan (Starter or higher)
   - Free tier services do not support persistent disks

2. Click the **"Add Disk"** button

3. Configure your disk with the following settings:
   
   **Name**: `documents-storage` (or any name you prefer)
   
   **Mount Path**: `/app/documents`
   - This is where the disk will be mounted in your container
   - Must match the `DOCUMENTS_PATH` environment variable (default is `./documents`)
   
   **Size**: `1` GB
   - Start with 1GB as requested
   - You can increase this later if needed (but cannot decrease)
   - Pricing: ~$0.25/GB per month on Render
   
4. Click **"Save"**

### Step 3: Wait for Disk Provisioning

1. Render will provision your disk, which takes about **1-3 minutes**
2. You'll see the disk status change from "Creating" to "Active"
3. Your service will automatically **restart** to mount the disk
   - This causes a brief downtime (30-60 seconds)
   - The health check endpoint will report unhealthy during restart

### Step 4: Verify Disk Is Mounted

Once your service has restarted and is healthy:

1. Go to the **"Shell"** tab in your Render dashboard
2. Click **"Connect"** to open an interactive shell
3. Run the following commands to verify the disk:

```bash
# Check if the disk is mounted
df -h | grep documents

# Expected output (size may vary):
# /dev/disk/by-id/scsi-0DO_Volume_documents-storage  974M   24K  907M   1% /app/documents

# Check directory permissions
ls -la /app/ | grep documents

# Expected output:
# drwxr-xr-x  2 root     root     4096 Jan  1 00:00 documents

# Test write permissions
touch /app/documents/test-file.txt && echo "Write test successful" || echo "Write test failed"

# Clean up test file
rm /app/documents/test-file.txt
```

If you see the disk mounted and can create files, your persistent disk is working correctly!

### Step 5: Update Environment Variables (Optional)

The default `DOCUMENTS_PATH` is `./documents`, which will automatically use `/app/documents` when running in the container. However, you can verify:

1. Go to the **"Environment"** tab
2. Check that `DOCUMENTS_PATH` is set to one of:
   - `./documents` (relative path - recommended)
   - `/app/documents` (absolute path)

If you need to change it:
1. Click **"Add Environment Variable"**
2. Key: `DOCUMENTS_PATH`
3. Value: `/app/documents`
4. Click **"Save Changes"** (this will trigger a redeploy)

### Step 6: Test PDF Generation and Persistence

1. Generate a test affidavit through your application
2. Note the filename or download the PDF
3. Go to the Shell tab and verify the file exists:

```bash
ls -lh /app/documents/
```

4. Trigger a manual redeploy:
   - Go to **"Manual Deploy"** → "Deploy latest commit"
   - Or push a new commit to trigger auto-deploy

5. After the deployment completes, check again:

```bash
ls -lh /app/documents/
```

You should still see your test PDF file! 🎉

## Troubleshooting

### Issue: "Disks" Tab Not Visible

**Solution**: Persistent disks require a paid plan (Starter, Standard, or Pro). Free tier services cannot use persistent disks.

1. Go to Settings → Plan
2. Upgrade to at least "Starter" ($7/month)
3. The Disks tab will appear after upgrading

### Issue: Permission Denied When Writing Files

**Solution**: Ensure your Node.js application has write permissions.

1. The disk is mounted as root by default
2. Check the Dockerfile creates the directory:
   ```dockerfile
   RUN mkdir -p documents
   ```

3. If needed, fix permissions in your Dockerfile:
   ```dockerfile
   RUN mkdir -p documents && chown -R node:node documents
   USER node
   ```

### Issue: Disk Full

**Solution**: Monitor disk usage and increase size if needed.

1. Check current usage in Shell:
   ```bash
   df -h /app/documents
   ```

2. To increase disk size:
   - Go to Disks tab
   - Click on your disk
   - Increase the size (you can only increase, not decrease)
   - Save changes

3. Consider implementing a cleanup job to delete old PDFs:
   ```javascript
   // Example: Delete PDFs older than 30 days
   const fs = require('fs').promises;
   const path = require('path');
   
   async function cleanupOldPDFs(directory, daysOld = 30) {
     const files = await fs.readdir(directory);
     const now = Date.now();
     const maxAge = daysOld * 24 * 60 * 60 * 1000;
     
     for (const file of files) {
       const filePath = path.join(directory, file);
       const stats = await fs.stat(filePath);
       
       if (now - stats.mtimeMs > maxAge) {
         await fs.unlink(filePath);
         console.log(`Deleted old PDF: ${file}`);
       }
     }
   }
   ```

### Issue: Files Not Persisting After Disk Setup

**Checklist**:
1. ✅ Verify disk mount path is `/app/documents`
2. ✅ Verify `DOCUMENTS_PATH` environment variable matches mount path
3. ✅ Check your PDF generation code uses the correct path:
   ```javascript
   const documentsPath = process.env.DOCUMENTS_PATH || './documents';
   const pdfPath = path.join(documentsPath, `affidavit-${id}.pdf`);
   ```
4. ✅ Restart your service after making changes
5. ✅ Check logs for permission errors

### Issue: Service Won't Start After Adding Disk

**Solution**: Check mount path conflicts.

1. Ensure mount path doesn't conflict with existing files
2. The `/app/documents` directory in your Docker image should exist but be empty
3. Check Dockerfile:
   ```dockerfile
   # This is correct - creates an empty directory
   RUN mkdir -p documents
   ```

4. Don't commit actual PDF files to your Git repository - the disk will override them

## Disk Backup and Recovery

Render automatically backs up persistent disks:

- **Frequency**: Daily snapshots
- **Retention**: 7 days of backups
- **Recovery**: Contact Render support to restore from backup

To manually backup files:

```bash
# In Render Shell
cd /app/documents
tar -czf backup-$(date +%Y%m%d).tar.gz *.pdf

# Download via SFTP (if enabled) or copy to another service
```

## Disk Pricing

Render charges for persistent disks separately from compute:

| Disk Size | Cost per Month |
|-----------|----------------|
| 1 GB      | ~$0.25/month   |
| 10 GB     | ~$2.50/month   |
| 50 GB     | ~$12.50/month  |
| 100 GB    | ~$25.00/month  |

**Pricing is approximate and based on $0.25/GB/month**. Check current pricing at: https://render.com/pricing

## Monitoring Disk Usage

Set up monitoring to avoid running out of space:

### Option 1: Manual Monitoring

Check disk usage regularly in the Shell:

```bash
df -h /app/documents
du -sh /app/documents
du -h /app/documents | sort -hr | head -20
```

### Option 2: Application-Level Monitoring

Add a health check endpoint that reports disk usage:

```javascript
// Add to your Express app
app.get('/api/admin/disk-usage', async (req, res) => {
  const { promisify } = require('util');
  const exec = promisify(require('child_process').exec);
  
  try {
    const { stdout } = await exec('df -h /app/documents');
    const lines = stdout.split('\n');
    const diskInfo = lines[1].split(/\s+/);
    
    res.json({
      filesystem: diskInfo[0],
      size: diskInfo[1],
      used: diskInfo[2],
      available: diskInfo[3],
      usePercent: diskInfo[4],
      mountPoint: diskInfo[5]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Option 3: Render Metrics

Render provides disk usage metrics in the dashboard:

1. Go to your service → **Metrics** tab
2. Look for "Disk Usage" graphs
3. Set up alerts for high disk usage (>80%)

## Migration from Ephemeral to Persistent Storage

If you already have a running service with ephemeral storage:

### Important Notes:
- ⚠️ **Existing PDFs in ephemeral storage will be lost** when the disk is mounted
- ⚠️ The mount point `/app/documents` will replace any existing directory
- ⚠️ Download any important PDFs before attaching the disk

### Migration Steps:

1. **Before attaching disk**: Download any PDFs you want to keep
   ```bash
   # In Render Shell (before disk setup)
   cd /app/documents
   ls -la
   # Download files via your application or manually copy
   ```

2. **Attach the disk** following Steps 1-3 above

3. **After disk is mounted**: Upload any PDFs you saved
   - Use your application's upload feature (if available)
   - Or manually copy via Shell/SFTP

4. **Update your deployment documentation** for your team

## Scaling Considerations

### Multiple Instances

If you scale your service to multiple instances:
- ⚠️ **Persistent disks cannot be shared** across multiple instances
- Each instance needs its own disk OR use cloud storage (S3)
- For horizontal scaling, migrate to AWS S3 or similar

### Recommended Architecture for Production:

Instead of persistent disks, consider:

1. **AWS S3** or **Cloudflare R2** for file storage
   - Supports multiple instances
   - Better for large-scale deployments
   - Automatic backups and versioning
   - CDN integration for faster downloads

2. **Keep disk for temporary files only**
   - Use disk as a cache/temporary workspace
   - Upload final PDFs to S3 immediately
   - Delete local copies after upload

Example S3 integration:
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

async function uploadToS3(localPath, key) {
  const fileStream = fs.createReadStream(localPath);
  
  await s3.upload({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: fileStream,
    ContentType: 'application/pdf'
  }).promise();
  
  // Delete local file after upload
  await fs.unlink(localPath);
}
```

## Summary

You now have a persistent disk attached to your Render.com Docker container:

✅ **1GB persistent disk** mounted at `/app/documents`
✅ **PDFs persist** across deployments and restarts
✅ **Automatic backups** by Render (7-day retention)
✅ **Can scale disk size** as needed (up to 1TB+)

For production applications with high traffic or multiple instances, consider migrating to S3-compatible storage for better scalability and reliability.

## Additional Resources

- [Render Persistent Disks Documentation](https://render.com/docs/disks)
- [Render Pricing](https://render.com/pricing)
- [Render Support](https://render.com/support)
- [Application Health Monitoring](https://render.com/docs/health-checks)

## Need Help?

- Check Render's community forum: https://community.render.com
- Review Render's status page: https://status.render.com
- Open an issue in this repository
- Contact Render support for disk-specific issues
