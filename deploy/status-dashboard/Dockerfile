FROM python:3.11-alpine

LABEL org.opencontainers.image.title="OurBlock Status Dashboard"
LABEL org.opencontainers.image.description="Node monitoring dashboard for OurBlock edge nodes"

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    flask==3.0.0 \
    requests==2.31.0 \
    docker==7.0.0

# Copy application files
COPY server.py .
COPY templates/ templates/
COPY static/ static/

# Create empty static directory if needed
RUN mkdir -p static

# Environment variables
ENV NEIGHBORHOOD_ID=unknown
ENV CONDUCTOR_URL=http://ourblock:8001
ENV DATA_DIR=/data
ENV FLASK_ENV=production

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -q --spider http://localhost:8080/health || exit 1

# Run the server
CMD ["python", "server.py"]
