# Homelab deployment

The GitHub repository is the source of truth for the Happy Home application. The server keeps a clean checkout at:

```text
/home/tofu/docker/happy-home/repository
```

The Dockerhand Compose stack remains separate at:

```text
/home/tofu/docker/dockerhand/data/stacks/Homelab/happy-home
```

MongoDB data, backups, Cloudflare credentials, and Web Push keys are not stored in Git.

## Deploy the latest main branch

Run on the homelab:

```sh
/home/tofu/docker/happy-home/repository/scripts/deploy-homelab.sh
```

The script refuses a dirty server checkout, performs a fast-forward-only pull, builds an image tagged with the Git revision, recreates only the application container, waits for its health check, and restores the previous image automatically if activation fails. MongoDB, backups, and the Cloudflare Tunnel remain running throughout the application update.

The script intentionally does not prune old images or delete historical deployment files. Cleanup is a separate maintenance operation so deployment remains recoverable.
