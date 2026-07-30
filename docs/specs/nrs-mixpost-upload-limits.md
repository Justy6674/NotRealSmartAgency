---
created: 2026-04-10
tags: [notrealsmart, mixpost, vps, infrastructure, reference]
project: NotRealSmart
---

# Mixpost Upload Limits — 2 GB config

As of 2026-04-10, Mixpost on the VPS accepts video uploads up to **2048 MB (2 GB)**. The bump touched four layers that all had to be raised in sync — any one of them at the old value would block uploads.

## The five layers

| Layer | File | Before | After |
|---|---|---|---|
| Host nginx (443 → 8585 proxy) | `/etc/nginx/sites-available/mixpost` | `client_max_body_size 100M` | `2048M` |
| Container nginx (serves Mixpost) | `/etc/nginx/sites-available/default` inside `mixpost-mixpost-1` | `70M` | `2048M` |
| Container PHP-FPM | `/etc/php/8.3/fpm/conf.d/99-app.ini` (image default) + `zzz-uploads.ini` (NRS override) | `upload_max_filesize 64M`, `post_max_size 70M`, `memory_limit 512M` | `2048M`, `2048M`, `1024M` |
| Mixpost Laravel validator | `MIXPOST_MAX_VIDEO_FILE_SIZE` in `/opt/mixpost/.env` | unset (default 200) | `2048` |
| **Horizon default queue timeout** | `/var/www/html/config/horizon.php` — `supervisor-1.timeout` | `60` (seconds) | `3600` |

### The Horizon timeout — the hidden fifth constraint

Even after bumping nginx + PHP + the Mixpost validator, the Scent Sell backfill still failed with `MaxAttemptsExceededException`. Root cause: `DownloadRemoteMediaJob` runs on the `default` Horizon queue, whose supervisor had `timeout: 60` (1 minute). A 2-pass ffmpeg transcode of a 364 MB .mov takes 5-10 minutes, so the worker was getting SIGKILLed at 60 seconds and the job never completed.

Fixed by sed-ing `'timeout' => 60,` → `'timeout' => 3600,` in `config/horizon.php` then:
```bash
docker exec mixpost-mixpost-1 bash -c "cd /var/www/html && php artisan config:clear && php artisan cache:clear && php artisan horizon:terminate"
```
Horizon's supervisor respawns workers automatically — wait ~6s and `ps aux | grep horizon:work` should show `--timeout=3600` on all workers.

**Persistence:** the horizon.php override lives at `/opt/mixpost/overrides/horizon.php` and is mounted into the container via docker-compose. Re-applied automatically on every `docker compose up -d`.

**The NRS client also has a matching timeout** at `src/lib/mixpost/sync-draft.ts:POLL_MAX_SECONDS = 1800` (30 min). Both sides of the upload have to wait long enough for the slowest ffmpeg pass.

The validator layer is the one most people forget — it's a Laravel validation rule in `src/Concerns/UsesFileConfig.php` inside the Pro package:
```php
return $this->convert((int) Util::config('max_file_size.video', 200), $unit);
```

If the env var is missing, the default is 200 MB regardless of nginx/PHP limits. The error you'd see: `"The video must no be greater than 200 MB"` (yes, with the typo — that's in Mixpost's source).

## How the overrides persist across container recreates

The container's filesystem is ephemeral — any changes made with `docker exec` are lost when `docker compose down && up` runs. Three override files on the host are mounted in via `docker-compose.yml`:

```yaml
services:
    mixpost:
        volumes:
            - storage:/var/www/html/storage/app
            - ./overrides/zzz-uploads.ini:/etc/php/8.3/fpm/conf.d/zzz-uploads.ini:ro
            - ./overrides/nginx-default.conf:/etc/nginx/sites-available/default:ro
            - ./overrides/horizon.php:/var/www/html/config/horizon.php:ro
```

- `zzz-uploads.ini` — loads *after* the image's `99-app.ini` (alphabetic ordering in conf.d), so its values win
- `nginx-default.conf` — full replacement of the site config, identical to the image default except `client_max_body_size 2048M`

**If Mixpost updates the image and changes the nginx default**, re-sync the override:
```bash
ssh vps
docker cp mixpost-mixpost-1:/etc/nginx/sites-available/default /tmp/new-default.conf
diff /opt/mixpost/overrides/nginx-default.conf /tmp/new-default.conf
# Merge any new directives into the override, keeping client_max_body_size 2048M
```

## Mixpost env vars added

In `/opt/mixpost/.env`:
```
MIXPOST_MAX_VIDEO_FILE_SIZE=2048
MIXPOST_MAX_IMAGE_FILE_SIZE=50
MIXPOST_MAX_GIF_FILE_SIZE=50
MIXPOST_CHUNKED_UPLOAD_THRESHOLD=50
MIXPOST_CHUNKED_UPLOAD_SIZE=50
```

Chunked upload threshold + size bumped from 10 MB to 50 MB so fewer chunks are needed for mid-size videos.

## To change the limit in future

1. `ssh vps`
2. Edit `/opt/mixpost/.env` — change `MIXPOST_MAX_VIDEO_FILE_SIZE=<new>`
3. Edit `/opt/mixpost/overrides/zzz-uploads.ini` — match with `upload_max_filesize = <new>M` + `post_max_size = <new>M`
4. Edit `/opt/mixpost/overrides/nginx-default.conf` — match with `client_max_body_size <new>M`
5. Edit `/etc/nginx/sites-available/mixpost` (host) — match with `client_max_body_size <new>M`
6. `nginx -t && systemctl reload nginx` (host)
7. `cd /opt/mixpost && docker compose up -d` (recreates Mixpost container with new env + mounts)

Verify with:
```bash
docker exec mixpost-mixpost-1 grep client_max_body_size /etc/nginx/sites-available/default
docker exec mixpost-mixpost-1 php-fpm8.3 -i | grep -E "upload_max_filesize|post_max_size"
docker exec mixpost-mixpost-1 env | grep MIXPOST_MAX
```

All four should match the new target.

## Backups

Backups live on the VPS with a UTC timestamp suffix, e.g. `2026-04-10T024914Z`:
- `/opt/mixpost/.env.bak.<stamp>`
- `/opt/mixpost/docker-compose.yml.bak.<stamp>`
- `/etc/nginx/sites-available/mixpost.bak.<stamp>`
- `/tmp/mixpost-nginx-default.bak.<stamp>` (original container nginx default)
- `/tmp/mixpost-php-99-app.bak.<stamp>` (original image PHP ini)

Rollback: copy the relevant `.bak.<stamp>` files back into place, then `nginx -t && systemctl reload nginx` + `docker compose up -d`.

## Why 2 GB and not more

- Matches what most paid SaaS competitors (Buffer, Hootsuite, Publer) offer
- Enough for 10-min 4K video at ~20 Mbps
- Under the VPS's practical RAM headroom with `memory_limit=1024M` + chunked uploads
- Well under LinkedIn / Facebook / YouTube platform caps (those go up to 256 GB for YouTube)

If a real need arises for >2 GB uploads, the change is the same 7 steps above. PHP memory isn't a hard blocker because chunked uploads stream data in 50 MB chunks.

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]

---
**Related entity:** [[Reference/wiki/entities/scentsell|scentsell]]
