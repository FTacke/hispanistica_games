# Nginx Configuration

This directory contains Nginx configuration templates for games_hispanistica.

## Files

| File | Purpose |
|------|---------|
| `games_hispanistica.conf.template` | Production vhost template |

## Installation

### 1. Copy template to Nginx

```bash
# On production server
sudo cp games_hispanistica.conf.template /etc/nginx/sites-available/games-hispanistica.conf
```

### 2. Replace variables

Edit the file and replace:
- `${DOMAIN}` → `games.hispanistica.com`
- `${HOST_PORT}` → `7000`

Or use sed:
```bash
sudo sed -i 's/\${DOMAIN}/games.hispanistica.com/g' /etc/nginx/sites-available/games-hispanistica.conf
sudo sed -i 's/\${HOST_PORT}/7000/g' /etc/nginx/sites-available/games-hispanistica.conf
```

### 3. Enable site

```bash
sudo ln -s /etc/nginx/sites-available/games-hispanistica.conf /etc/nginx/sites-enabled/
```

### 4. Obtain SSL certificate

```bash
sudo certbot certonly --webroot \
  -w /var/www/letsencrypt \
  -d games.hispanistica.com
```

### 5. Test and reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

```bash
# Local (from server)
curl -I http://localhost:7000/health

# Public
curl -I https://games.hispanistica.com/health
```

## Troubleshooting

```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/games-hispanistica.error.log

# Check Nginx config
sudo nginx -t

# Check if port is listening
sudo ss -tlnp | grep 7000
```
