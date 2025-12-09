# Docker Hub Setup for Akash Deployment

Since you don't have permission to make the GHCR package public, we'll use Docker Hub instead (public by default).

## Step 1: Create Docker Hub Account

1. Go to https://hub.docker.com
2. Sign up or log in
3. Note your Docker Hub username

## Step 2: Add Docker Hub Credentials to GitHub Secrets

1. Go to your GitHub repository: `https://github.com/si3-ecosystem/AgentKaia`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add two secrets:
   - **Name**: `DOCKER_USERNAME`
     **Value**: Your Docker Hub username
   - **Name**: `DOCKER_PASSWORD`
     **Value**: Your Docker Hub password (or access token)

   **Note**: For better security, use a Docker Hub access token instead of password:
   - Go to Docker Hub → Account Settings → Security → New Access Token
   - Create token with "Read & Write" permissions
   - Use this token as `DOCKER_PASSWORD`

## Step 3: Update deploy.sdl.yaml

Replace `YOUR_DOCKERHUB_USERNAME` in `deploy.sdl.yaml` with your actual Docker Hub username:

```yaml
image: docker.io/yourusername/agentkaia:latest
```

## Step 4: Push Code to Trigger Build

Once you push to `main`, GitHub Actions will:
1. Build the Docker image
2. Push to both GHCR (private) and Docker Hub (public)
3. Akash will pull from Docker Hub (public, no auth needed)

## Step 5: Deploy to Akash

Your `deploy.sdl.yaml` is now configured to use Docker Hub. Deploy as normal.

## Verification

After the workflow runs, verify the image is on Docker Hub:
- Go to `https://hub.docker.com/r/yourusername/agentkaia`
- You should see the image with `latest` tag

## Fallback

If Docker Hub doesn't work, you can also:
- Ask someone with org permissions to make GHCR package public
- Use a different public registry
- Use version tags (sometimes work even with private packages)

