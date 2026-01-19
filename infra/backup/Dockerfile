# Automated Backup Service for OurBlock
# Creates encrypted daily backups of Holochain data and Lair keystore
#
# Features:
# - Daily backups at 3 AM
# - AES-256 encryption using ADMIN_API_KEY
# - Compressed tarballs for efficient storage
# - Graceful conductor shutdown during backup
# - Automatic cleanup of old backups (30 day retention)

FROM alpine:3.18

# Install required tools
RUN apk add --no-cache \
    bash \
    curl \
    tar \
    gzip \
    openssl \
    dcron \
    docker-cli \
    jq

# Create backup directory
RUN mkdir -p /backups /scripts

# Copy backup script
COPY backup.sh /scripts/backup.sh
RUN chmod +x /scripts/backup.sh

# Create crontab for daily backups at 3 AM
RUN echo "0 3 * * * /scripts/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

# Create log file
RUN touch /var/log/backup.log

# Health check - verify cron is running and backups exist
HEALTHCHECK --interval=24h --timeout=30s --start-period=1m --retries=3 \
    CMD [ -f "/backups/latest-backup.tar.gz.enc" ] || exit 1

# Start cron daemon in foreground
CMD ["crond", "-f", "-l", "2"]
