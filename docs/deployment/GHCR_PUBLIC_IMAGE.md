# Making GitHub Container Registry Image Public

## Problem

Akash deployments fail with:
```
401 Unauthorized: failed to authorize: failed to fetch anonymous token
```

This happens because GitHub Container Registry (GHCR) packages are **private by default**, and Akash deployments cannot authenticate to pull private images.

## Solution: Make the Package Public

### Step 1: Navigate to Package Settings

1. Go to your GitHub repository: `https://github.com/si3-ecosystem/AgentKaia`
2. Click on **"Packages"** in the right sidebar (or go to `https://github.com/orgs/si3-ecosystem/packages`)
3. Find the `agentkaia` package
4. Click on it to open the package page

### Step 2: Change Visibility to Public

1. On the package page, click **"Package settings"** (gear icon or link)
2. Scroll down to the **"Danger Zone"** section
3. Click **"Change visibility"**
4. Select **"Public"**
5. Confirm the change

### Step 3: Verify

After making it public, verify the image can be pulled anonymously:

```bash
docker pull ghcr.io/si3-ecosystem/agentkaia:latest
```

If it works without authentication, the deployment should now succeed.

## Alternative Solutions

### Option 1: Use Docker Hub (Public by Default)

If you prefer not to make the GHCR package public:

1. Update `.github/workflows/docker-publish.yml` to also push to Docker Hub:
   ```yaml
   tags: |
     docker.io/yourusername/agentkaia:latest
     ghcr.io/${{ github.repository_owner }}/agentkaia:latest
   ```

2. Update `deploy.sdl.yaml`:
   ```yaml
   image: docker.io/yourusername/agentkaia:latest
   ```

3. Add Docker Hub credentials to GitHub Secrets:
   - `DOCKER_USERNAME`
   - `DOCKER_PASSWORD`

### Option 2: Use a Specific Version Tag Instead of `latest`

Sometimes using a specific version tag works better:

1. Update `deploy.sdl.yaml` to use a version tag:
   ```yaml
   image: ghcr.io/si3-ecosystem/agentkaia:v1.0.0
   ```

2. Update the workflow to tag with version numbers

### Option 3: Use Image Pull Secrets (If Akash Supports It)

Akash SDL v2.0 may support image pull secrets, but this is not commonly used. Check Akash documentation for the latest support.

## Recommended Approach

**Make the GHCR package public** - This is the simplest solution and works well for open-source or organization projects. The image itself doesn't contain secrets (those are in environment variables), so making it public is safe.

## Security Note

Making the Docker image public is safe because:
- Environment variables (secrets) are not in the image
- Secrets are passed via `deploy.sdl.yaml` environment variables
- The image only contains code, not credentials

