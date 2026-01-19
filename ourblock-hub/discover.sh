#!/usr/bin/env bashio
# mDNS Discovery Service - Announces OurBlock Hub on local network

set -e

# Source bashio library
if [ -f /usr/lib/bashio/bashio.sh ]; then
    source /usr/lib/bashio/bashio.sh
fi

bashio::log.info "Starting mDNS broadcast for ourblock.local..."

# Start Avahi daemon (mDNS/Bonjour implementation)
dbus-daemon --system
avahi-daemon --daemonize

# Create service definition for OurBlock
cat > /etc/avahi/services/ourblock.service <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">OurBlock Hub on %h</name>
  <service>
    <type>_ourblock._tcp</type>
    <port>8888</port>
    <txt-record>version=0.1.0</txt-record>
    <txt-record>name=${NEIGHBORHOOD_NAME:-My Neighborhood}</txt-record>
    <txt-record>type=hub</txt-record>
  </service>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
    <txt-record>path=/</txt-record>
  </service>
</service-group>
EOF

# Reload Avahi to pick up the new service
avahi-daemon --reload

bashio::log.info "mDNS service registered! Neighbors can now discover this hub at:"
bashio::log.info "  - Web UI: https://ourblock.local"
bashio::log.info "  - Mobile: ws://ourblock.local:8888"

# Keep the script running
tail -f /dev/null
