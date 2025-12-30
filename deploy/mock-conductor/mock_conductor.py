#!/usr/bin/env python3
"""
Mock Holochain Conductor for Development/Testing
Simulates the health and admin endpoints.
"""

from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/health')
def health():
    return 'OK', 200

@app.route('/api/admin/v0/interfaces', methods=['GET', 'POST'])
def interfaces():
    return jsonify({'peers': 3})

@app.route('/')
def index():
    return jsonify({
        'service': 'OurBlock Mock Conductor',
        'status': 'running',
        'version': 'dev'
    })

if __name__ == '__main__':
    print("Starting Mock Conductor on port 8001...")
    app.run(host='0.0.0.0', port=8001)
