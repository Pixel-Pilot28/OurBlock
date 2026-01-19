FROM nginx:1.25-alpine

# Copy SSL certificates
COPY certs/localhost.crt /etc/nginx/certs/localhost.crt
COPY certs/localhost.key /etc/nginx/certs/localhost.key

# Copy nginx configuration
COPY sidecar.conf /etc/nginx/conf.d/default.conf

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf.template

# Create log directory
RUN mkdir -p /var/log/nginx && \
    chown -R nginx:nginx /var/log/nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

EXPOSE 443 80

CMD ["nginx", "-g", "daemon off;"]
