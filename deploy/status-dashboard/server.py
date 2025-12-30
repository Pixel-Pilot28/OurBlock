#!/usr/bin/env python3
"""
OurBlock Status Dashboard Server
Provides a simple web UI showing node status, vouches, and storage.
"""

import os
import json
import time
import threading
from datetime import datetime
from flask import Flask, render_template, jsonify, send_from_directory
import requests

app = Flask(__name__, static_folder='static', template_folder='templates')

# Configuration
NEIGHBORHOOD_ID = os.environ.get('NEIGHBORHOOD_ID', 'unknown')
CONDUCTOR_URL = os.environ.get('CONDUCTOR_URL', 'http://ourblock:8001')
DATA_DIR = os.environ.get('DATA_DIR', '/data')

# Try to import Docker - may not be available in all environments
try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False

# Cache for stats
stats_cache = {
    'online': False,
    'uptime': 0,
    'start_time': time.time(),
    'vouches_processed': 0,
    'storage_used_mb': 0,
    'peers_connected': 0,
    'containers': {},
    'last_update': None
}

def format_uptime(seconds):
    """Format uptime in human-readable format."""
    days = int(seconds // 86400)
    hours = int((seconds % 86400) // 3600)
    minutes = int((seconds % 3600) // 60)
    
    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        return f"{hours}h {minutes}m"
    else:
        return f"{minutes}m"

def get_storage_used():
    """Get storage used by conductor data."""
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(DATA_DIR):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if os.path.exists(fp):
                    total_size += os.path.getsize(fp)
    except Exception:
        pass
    return total_size / (1024 * 1024)  # Convert to MB

def get_container_status():
    """Get Docker container status."""
    if not DOCKER_AVAILABLE:
        return {'conductor': 'docker unavailable', 'lair': 'docker unavailable', 'ui': 'docker unavailable'}
    
    try:
        client = docker.from_env()
        containers = {
            'conductor': 'ourblock-conductor',
            'lair': 'ourblock-lair',
            'ui': 'ourblock-ui'
        }
        
        status = {}
        for name, container_name in containers.items():
            try:
                container = client.containers.get(container_name)
                status[name] = container.status
            except docker.errors.NotFound:
                status[name] = 'not found'
            except Exception:
                status[name] = 'unknown'
        
        return status
    except Exception:
        return {'conductor': 'unknown', 'lair': 'unknown', 'ui': 'unknown'}

def get_conductor_stats():
    """Get statistics from the Holochain conductor."""
    try:
        # Try to get admin interface stats
        response = requests.post(
            f"{CONDUCTOR_URL}/api/admin/v0/interfaces",
            json={},
            timeout=5
        )
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    return None

def update_stats():
    """Update stats cache periodically."""
    global stats_cache
    
    while True:
        try:
            # Check conductor health
            try:
                response = requests.get(f"{CONDUCTOR_URL}/health", timeout=5)
                stats_cache['online'] = response.status_code == 200
            except Exception:
                # Try alternative health check
                try:
                    response = requests.get(f"{CONDUCTOR_URL}", timeout=5)
                    stats_cache['online'] = response.status_code in [200, 404]
                except Exception:
                    stats_cache['online'] = False
            
            # Update uptime
            stats_cache['uptime'] = time.time() - stats_cache['start_time']
            
            # Get storage used
            stats_cache['storage_used_mb'] = get_storage_used()
            
            # Get container status
            stats_cache['containers'] = get_container_status()
            
            # Get conductor stats if available
            conductor_stats = get_conductor_stats()
            if conductor_stats:
                stats_cache['peers_connected'] = conductor_stats.get('peers', 0)
            
            # Update timestamp
            stats_cache['last_update'] = datetime.now().isoformat()
            
        except Exception as e:
            print(f"Error updating stats: {e}")
        
        time.sleep(10)

@app.route('/')
def index():
    """Render the status dashboard."""
    return render_template('index.html',
        neighborhood_id=NEIGHBORHOOD_ID,
        stats=stats_cache,
        uptime_formatted=format_uptime(stats_cache['uptime'])
    )

@app.route('/api/status')
def api_status():
    """Return status as JSON."""
    return jsonify({
        'neighborhood_id': NEIGHBORHOOD_ID,
        'online': stats_cache['online'],
        'uptime_seconds': stats_cache['uptime'],
        'uptime_formatted': format_uptime(stats_cache['uptime']),
        'vouches_processed': stats_cache['vouches_processed'],
        'storage_used_mb': round(stats_cache['storage_used_mb'], 2),
        'peers_connected': stats_cache['peers_connected'],
        'containers': stats_cache.get('containers', {}),
        'last_update': stats_cache['last_update']
    })

@app.route('/api/neighborhood')
def api_neighborhood():
    """Return neighborhood info."""
    return jsonify({
        'id': NEIGHBORHOOD_ID,
        'join_command': f'curl -fsSL https://ourblock.community/install.sh | bash -s -- -n {NEIGHBORHOOD_ID}'
    })

@app.route('/health')
def health():
    """Health check endpoint."""
    return 'OK', 200

@app.route('/static/<path:filename>')
def static_files(filename):
    """Serve static files."""
    return send_from_directory('static', filename)

if __name__ == '__main__':
    print(f"Starting OurBlock Status Dashboard")
    print(f"  Neighborhood: {NEIGHBORHOOD_ID}")
    print(f"  Conductor URL: {CONDUCTOR_URL}")
    print(f"  Data Directory: {DATA_DIR}")
    print(f"  Docker Available: {DOCKER_AVAILABLE}")
    
    # Start stats update thread
    stats_thread = threading.Thread(target=update_stats, daemon=True)
    stats_thread.start()
    
    # Run Flask app
    app.run(host='0.0.0.0', port=8080, debug=False, threaded=True)
