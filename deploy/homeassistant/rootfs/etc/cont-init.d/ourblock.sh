#!/usr/bin/with-contenv bashio
# ═══════════════════════════════════════════════════════════════════════════════
# OurBlock - Home Assistant Add-on Initialization
# ═══════════════════════════════════════════════════════════════════════════════

# Read configuration
NEIGHBORHOOD_ID=$(bashio::config 'neighborhood_id')
LOG_LEVEL=$(bashio::config 'log_level')

# Generate neighborhood ID if not set
if [ -z "$NEIGHBORHOOD_ID" ]; then
    if [ -f /data/neighborhood_id ]; then
        NEIGHBORHOOD_ID=$(cat /data/neighborhood_id)
    else
        NEIGHBORHOOD_ID="ha-$(openssl rand -hex 4)"
        echo "$NEIGHBORHOOD_ID" > /data/neighborhood_id
    fi
    bashio::log.info "Using Neighborhood ID: $NEIGHBORHOOD_ID"
fi

# Export environment variables for other services
echo "NEIGHBORHOOD_ID=$NEIGHBORHOOD_ID" > /var/run/s6/container_environment/NEIGHBORHOOD_ID
echo "RUST_LOG=$LOG_LEVEL" > /var/run/s6/container_environment/RUST_LOG

bashio::log.info "OurBlock Add-on initialized"
bashio::log.info "  Neighborhood: $NEIGHBORHOOD_ID"
bashio::log.info "  Log Level: $LOG_LEVEL"
