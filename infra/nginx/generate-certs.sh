#!/bin/bash
set -e

CERT_DIR="certs"
CERT_FILE="$CERT_DIR/localhost.crt"
KEY_FILE="$CERT_DIR/localhost.key"

# Create certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Check if certificates already exist
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "✓ Certificates already exist in $CERT_DIR/"
    echo "  - Certificate: $CERT_FILE"
    echo "  - Private Key: $KEY_FILE"
    exit 0
fi

echo "Generating self-signed SSL certificate for localhost..."

# Generate private key and certificate
openssl req -x509 \
    -nodes \
    -days 365 \
    -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/C=US/ST=State/L=City/O=OurBlock/OU=Development/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Set proper permissions
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "✓ SSL certificates generated successfully!"
echo "  - Certificate: $CERT_FILE"
echo "  - Private Key: $KEY_FILE"
echo ""
echo "These certificates are valid for 365 days."
echo "⚠️  WARNING: These are self-signed certificates for development only."
echo "    Your browser will show a security warning - this is expected."
