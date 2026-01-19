/**
 * OurBlock Sidecar Management Service
 * 
 * This service handles system-level operations like Docker container updates and restarts.
 * Can run either on the Docker host or as a container with Docker socket access.
 * 
 * Run with: node server.js
 * Listens on: http://localhost:3001
 */

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const DOCKER_COMPOSE_PATH = process.env.DOCKER_COMPOSE_FILE || path.join(__dirname, '..', 'docker-compose.yml');
const PACKAGE_JSON_PATH = process.env.PACKAGE_JSON_PATH || path.join(__dirname, '..', 'package.json');
const IS_CONTAINERIZED = process.env.NODE_ENV === 'production';

// Get current version from package.json
function getCurrentVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    return packageJson.version || '0.1.0';
  } catch (error) {
    console.error('Error reading package.json:', error);
    return '0.1.0';
  }
}

// Get latest version from Docker Hub (placeholder - implement actual API call)
async function getLatestVersion() {
  // TODO: Implement actual Docker Hub API call
  // For now, return current version + 0.0.1
  const current = getCurrentVersion();
  const parts = current.split('.');
  parts[2] = String(parseInt(parts[2]) + 1);
  return parts.join('.');
}

// Execute Docker Compose commands
function executeDockerCommand(command) {
  const dockerComposePath = DOCKER_COMPOSE_PATH;
  
  if (!fs.existsSync(dockerComposePath)) {
    throw new Error(`docker-compose.yml not found at ${dockerComposePath}`);
  }

  // When running in container, use docker compose directly with -f flag
  // When running on host, cd to directory first
  let fullCommand;
  if (IS_CONTAINERIZED) {
    fullCommand = `docker compose -f ${dockerComposePath} ${command}`;
  } else {
    fullCommand = `cd "${path.dirname(dockerComposePath)}" && ${command}`;
  }
  
  console.log(`Executing: ${fullCommand}`);
  
  const output = execSync(fullCommand, { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  return output;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    // GET /health - Health check endpoint
    if (url.pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /version - Get current and latest version info
    if (url.pathname === '/version' && req.method === 'GET') {
      const currentVersion = getCurrentVersion();
      const latestVersion = await getLatestVersion();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        version: currentVersion,
        latest: latestVersion,
        updateAvailable: latestVersion !== currentVersion
      }));
      return;
    }

    // POST /update - Trigger Docker Compose update
    if (url.pathname === '/update' && req.method === 'POST') {
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        console.log('Update request received:', body);
        
        // Send immediate response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'updating',
          message: 'Update process started'
        }));

        // Execute update in background
        setTimeout(() => {
          try {
            console.log('Pulling latest images...');
            executeDockerCommand('docker compose pull');
            
            console.log('Restarting containers...');
            executeDockerCommand('docker compose up -d');
            
            console.log('Update completed successfully');
          } catch (error) {
            console.error('Update failed:', error);
          }
        }, 100);
      });
      return;
    }

    // POST /restart - Restart Docker containers
    if (url.pathname === '/restart' && req.method === 'POST') {
      console.log('Restart request received');
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'restarting',
        message: 'Restart process started'
      }));

      // Execute restart in background
      setTimeout(() => {
        try {
          console.log('Restarting containers...');
          executeDockerCommand('docker compose restart');
          console.log('Restart completed successfully');
        } catch (error) {
          console.error('Restart failed:', error);
        }
      }, 100);
      return;
    }

    // 404 - Not Found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Not found',
      path: url.pathname 
    }));
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 OurBlock Sidecar Service running on http://localhost:${PORT}`);
  console.log(`   Current version: ${getCurrentVersion()}`);
  console.log(`   Docker Compose: ${DOCKER_COMPOSE_PATH}`);
  console.log('\nAvailable endpoints:');
  console.log('   GET  /health  - Health check');
  console.log('   GET  /version - Version information');
  console.log('   POST /update  - Trigger Docker update');
  console.log('   POST /restart - Restart containers\n');
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
