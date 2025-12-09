# Migration Guide: Moving to si<3> Organization

## Step 1: Create New Repository

1. Go to https://github.com/organizations/si3/repositories/new
2. Repository name: `agentkaia`
3. Description: "Agent Kaia - Multi-agent swarm for SI<3> community"
4. Set to **Private** (or Public, your choice)
5. **Don't** initialize with README, .gitignore, or license (we'll push existing code)
6. Click "Create repository"

## Step 2: Update Remote and Push

```bash
# Check current remote
git remote -v

# Update remote to new repository
git remote set-url origin https://github.com/si3/agentkaia.git

# Or if using SSH:
git remote set-url origin git@github.com:si3/agentkaia.git

# Push all branches and tags
git push -u origin main
git push --all
git push --tags
```

## Step 3: Update GitHub Actions Workflow

The workflow already uses `${{ github.repository_owner }}` which will automatically use `si3` instead of `wonderofme`. However, you may want to update the image name.

## Step 4: Update Deployment Configuration

Update `deploy.sdl.yaml` to use the new image path:
- Old: `ghcr.io/wonderofme/kaia-swarm:v207`
- New: `ghcr.io/si3/agentkaia:v207`

## Step 5: Verify GitHub Actions

After pushing, check:
1. Go to Actions tab in the new repository
2. Verify the workflow runs successfully
3. Check that the Docker image is published to `ghcr.io/si3/agentkaia`

## Step 6: Update Secrets (if needed)

If you have any GitHub secrets that reference the old repository, update them in:
Settings → Secrets and variables → Actions

## Step 7: Test Deployment

After the Docker image is built, test the Akash deployment with the updated `deploy.sdl.yaml`.

