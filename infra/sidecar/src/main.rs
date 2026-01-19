use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, State,
    },
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, process::Command, sync::Arc, time::Duration};
use tower::ServiceBuilder;
use tower_governor::{
    governor::GovernorConfigBuilder, key_extractor::SmartIpKeyExtractor, GovernorLayer,
};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    services::ServeDir,
    trace::TraceLayer,
};
use tracing::{error, info, warn};

// ============================================================================
// Configuration
// ============================================================================

#[derive(Clone)]
struct AppState {
    admin_api_key: String,
    docker_compose_file: String,
    neighborhood_name: String,
    mdns_hostname: String,
}

// ============================================================================
// API Models
// ============================================================================

#[derive(Serialize, Deserialize)]
struct HealthResponse {
    status: String,
    timestamp: String,
}

#[derive(Serialize, Deserialize)]
struct VersionInfo {
    version: String,
    latest: String,
    update_available: bool,
}

#[derive(Deserialize)]
struct UpdateRequest {
    version: Option<String>,
}

#[derive(Serialize)]
struct UpdateResponse {
    status: String,
    message: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

// ============================================================================
// Authentication Middleware
// ============================================================================

async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    request: axum::http::Request<axum::body::Body>,
    next: Next,
) -> Result<Response, (StatusCode, Json<ErrorResponse>)> {
    // Skip auth for health check endpoint
    if request.uri().path() == "/health" {
        return Ok(next.run(request).await);
    }

    // Extract real IP from X-Real-IP header (set by nginx)
    let real_ip = headers
        .get("X-Real-IP")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    let api_key = headers
        .get("X-OurBlock-Admin-Key")
        .and_then(|v| v.to_str().ok());

    if api_key != Some(&state.admin_api_key) {
        warn!(
            real_ip = real_ip,
            proxy_ip = %addr.ip(),
            path = %request.uri().path(),
            "Unauthorized access attempt"
        );
        
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Invalid or missing API key".to_string(),
            }),
        ));
    }

    info!(
        real_ip = real_ip,
        proxy_ip = %addr.ip(),
        path = %request.uri().path(),
        "Authenticated request"
    );

    Ok(next.run(request).await)
}

// ============================================================================
// Handlers
// ============================================================================

async fn health_handler() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        timestamp: Utc::now().to_rfc3339(),
    })
}

async fn version_handler() -> Result<Json<VersionInfo>, (StatusCode, Json<ErrorResponse>)> {
    let current_version = std::env::var("APP_VERSION").unwrap_or_else(|_| "0.1.0".to_string());
    
    // TODO: Query Docker Hub or GitHub for latest version
    let latest_version = current_version.clone();
    let update_available = false;

    Ok(Json(VersionInfo {
        version: current_version.clone(),
        latest: latest_version.clone(),
        update_available,
    }))
}

async fn update_handler(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(payload): Json<UpdateRequest>,
) -> Result<Json<UpdateResponse>, (StatusCode, Json<ErrorResponse>)> {
    let real_ip = headers
        .get("X-Real-IP")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    
    info!(
        real_ip = real_ip,
        proxy_ip = %addr.ip(),
        version = ?payload.version,
        "Update request received"
    );

    // Execute docker compose pull and up in background
    tokio::spawn(async move {
        match execute_docker_update(&state.docker_compose_file).await {
            Ok(_) => {
                info!("Update completed successfully");
            }
            Err(e) => {
                error!(error = %e, "Update failed");
            }
        }
    });

    Ok(Json(UpdateResponse {
        status: "updating".to_string(),
        message: "Update process started".to_string(),
    }))
}

async fn restart_handler(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Result<Json<UpdateResponse>, (StatusCode, Json<ErrorResponse>)> {
    let real_ip = headers
        .get("X-Real-IP")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    
    info!(
        real_ip = real_ip,
        proxy_ip = %addr.ip(),
        "Restart request received"
    );

    tokio::spawn(async {
        match execute_docker_restart().await {
            Ok(_) => {
                info!("Restart completed successfully");
            }
            Err(e) => {
                error!(error = %e, "Restart failed");
            }
        }
    });

    Ok(Json(UpdateResponse {
        status: "restarting".to_string(),
        message: "Restart process started".to_string(),
    }))
}

// ============================================================================
// WebSocket Handler for Mobile Clients
// ============================================================================

async fn ws_handler(
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    info!(client_ip = %addr.ip(), "New WebSocket connection");
    ws.on_upgrade(move |socket| handle_socket(socket, addr))
}

async fn handle_socket(mut socket: WebSocket, addr: SocketAddr) {
    info!(client_ip = %addr.ip(), "WebSocket connection established");
    
    // Send welcome message
    let welcome = serde_json::json!({
        "type": "welcome",
        "message": "Connected to OurBlock Hub",
        "version": std::env::var("APP_VERSION").unwrap_or_else(|_| "0.1.0".to_string()),
    });
    
    if socket
        .send(Message::Text(welcome.to_string()))
        .await
        .is_err()
    {
        error!(client_ip = %addr.ip(), "Failed to send welcome message");
        return;
    }

    // Handle incoming messages
    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(text)) => {
                info!(client_ip = %addr.ip(), message = %text, "Received message");
                
                // Echo back for now (will be replaced with Holochain conductor proxy)
                let response = serde_json::json!({
                    "type": "echo",
                    "data": text,
                });
                
                if socket
                    .send(Message::Text(response.to_string()))
                    .await
                    .is_err()
                {
                    error!(client_ip = %addr.ip(), "Failed to send response");
                    break;
                }
            }
            Ok(Message::Close(_)) => {
                info!(client_ip = %addr.ip(), "Client closed connection");
                break;
            }
            Err(e) => {
                error!(client_ip = %addr.ip(), error = %e, "WebSocket error");
                break;
            }
            _ => {}
        }
    }

    info!(client_ip = %addr.ip(), "WebSocket connection closed");
}

// ============================================================================
// mDNS Service Discovery
// ============================================================================

async fn start_mdns_service(hostname: &str, neighborhood_name: &str, port: u16) {
    info!("Starting mDNS service discovery...");
    
    let mdns = match ServiceDaemon::new() {
        Ok(daemon) => daemon,
        Err(e) => {
            error!(error = %e, "Failed to create mDNS daemon");
            return;
        }
    };

    let service_type = "_ourblock._tcp.local.";
    let instance_name = format!("OurBlock Hub - {}", neighborhood_name);
    
    let properties = [
        ("version", "0.1.0"),
        ("neighborhood", neighborhood_name),
        ("type", "hub"),
    ];

    let service_info = ServiceInfo::new(
        service_type,
        &instance_name,
        hostname,
        (),
        port,
        &properties[..],
    )
    .expect("Failed to create service info");

    match mdns.register(service_info) {
        Ok(_) => {
            info!(
                hostname = hostname,
                neighborhood = neighborhood_name,
                "mDNS service registered successfully"
            );
            info!("Neighbors can discover this hub at: {}", hostname);
        }
        Err(e) => {
            error!(error = %e, "Failed to register mDNS service");
        }
    }

    // Keep the daemon running
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
        }
    });
}

// ============================================================================
// Backup Management Handlers
// ============================================================================

#[derive(Serialize)]
struct BackupStatusResponse {
    timestamp: String,
    size: String,
    filename: String,
}

/// GET /api/system/backup/status
/// Returns information about the latest backup
async fn backup_status_handler() -> Result<Json<BackupStatusResponse>, (StatusCode, Json<ErrorResponse>)> {
    info!("Backup status requested");
    
    // Check if latest backup symlink exists
    let backup_path = "/backups/latest-backup.tar.gz.enc";
    
    match tokio::fs::metadata(backup_path).await {
        Ok(metadata) => {
            let size_bytes = metadata.len();
            let size_mb = size_bytes as f64 / (1024.0 * 1024.0);
            let size = format!("{:.2} MB", size_mb);
            
            // Get modification time
            let modified = metadata.modified().map_err(|e| {
                error!(error = %e, "Failed to get backup modification time");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Failed to get backup metadata".to_string(),
                    }),
                )
            })?;
            
            let timestamp = chrono::DateTime::<chrono::Utc>::from(modified)
                .to_rfc3339();
            
            Ok(Json(BackupStatusResponse {
                timestamp,
                size,
                filename: "latest-backup.tar.gz.enc".to_string(),
            }))
        }
        Err(e) => {
            warn!(error = %e, "No backup found");
            Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "No backups available".to_string(),
                }),
            ))
        }
    }
}

/// GET /api/system/backup/download
/// Downloads the latest encrypted backup file
async fn download_backup_handler() -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!("Backup download requested");
    
    let backup_path = "/backups/latest-backup.tar.gz.enc";
    
    // Read backup file
    let file_contents = tokio::fs::read(backup_path).await.map_err(|e| {
        error!(error = %e, "Failed to read backup file");
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Backup file not found".to_string(),
            }),
        )
    })?;
    
    // Generate filename with timestamp
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let filename = format!("ourblock_backup_{}.tar.gz.enc", timestamp);
    
    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        "application/octet-stream".parse().unwrap(),
    );
    headers.insert(
        axum::http::header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{}\"", filename)
            .parse()
            .unwrap(),
    );
    
    info!(filename = %filename, size = file_contents.len(), "Sending backup file");
    
    Ok((headers, file_contents))
}

/// POST /api/system/backup/trigger
/// Triggers a manual backup by executing the backup script
async fn trigger_backup_handler() -> Result<Json<UpdateResponse>, (StatusCode, Json<ErrorResponse>)> {
    info!("Manual backup triggered");
    
    // Execute backup script in backup container
    let output = Command::new("docker")
        .args([
            "exec",
            "ourblock-backup",
            "/scripts/backup.sh",
        ])
        .output()
        .map_err(|e| {
            error!(error = %e, "Failed to execute backup script");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to trigger backup: {}", e),
                }),
            )
        })?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        error!(stderr = %stderr, "Backup script failed");
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Backup failed: {}", stderr),
            }),
        ));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    info!(stdout = %stdout, "Backup completed");
    
    Ok(Json(UpdateResponse {
        status: "success".to_string(),
        message: "Backup completed successfully".to_string(),
    }))
}

// ============================================================================
// Docker Operations
// ============================================================================

async fn execute_docker_update(compose_file: &str) -> Result<(), String> {
    info!("Pulling latest Docker images...");
    
    let pull_output = Command::new("docker")
        .args(["compose", "-f", compose_file, "pull"])
        .output()
        .map_err(|e| format!("Failed to execute docker compose pull: {}", e))?;

    if !pull_output.status.success() {
        let stderr = String::from_utf8_lossy(&pull_output.stderr);
        return Err(format!("Docker compose pull failed: {}", stderr));
    }

    info!("Restarting containers with new images...");
    
    let up_output = Command::new("docker")
        .args(["compose", "-f", compose_file, "up", "-d"])
        .output()
        .map_err(|e| format!("Failed to execute docker compose up: {}", e))?;

    if !up_output.status.success() {
        let stderr = String::from_utf8_lossy(&up_output.stderr);
        return Err(format!("Docker compose up failed: {}", stderr));
    }

    Ok(())
}

async fn execute_docker_restart() -> Result<(), String> {
    info!("Restarting Docker containers...");
    
    let output = Command::new("docker")
        .args(["compose", "restart"])
        .output()
        .map_err(|e| format!("Failed to execute docker compose restart: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker compose restart failed: {}", stderr));
    }

    Ok(())
}

// ============================================================================
// Main Application
// ============================================================================

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .json()
        .init();

    // Load configuration from environment
    dotenvy::dotenv().ok();
    
    let admin_api_key = std::env::var("ADMIN_API_KEY")
        .unwrap_or_else(|_| "change-me-in-production".to_string());
    
    if admin_api_key == "change-me-in-production" {
        warn!("⚠️  Using default API key - CHANGE THIS IN PRODUCTION!");
    }

    let docker_compose_file = std::env::var("DOCKER_COMPOSE_FILE")
        .unwrap_or_else(|_| "/app/docker-compose.yaml".to_string());

    let neighborhood_name = std::env::var("NEIGHBORHOOD_NAME")
        .unwrap_or_else(|_| "My Neighborhood".to_string());

    let mdns_hostname = std::env::var("MDNS_HOSTNAME")
        .unwrap_or_else(|_| "ourblock.local".to_string());

    let ui_path = std::env::var("UI_PATH")
        .unwrap_or_else(|_| "/app/ui/dist".to_string());

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse()
        .expect("PORT must be a valid number");

    let state = Arc::new(AppState {
        admin_api_key,
        docker_compose_file,
        neighborhood_name: neighborhood_name.clone(),
        mdns_hostname: mdns_hostname.clone(),
    });

    // Start mDNS service discovery
    start_mdns_service(&mdns_hostname, &neighborhood_name, port).await;

    // Configure rate limiting: 1 request per 5 minutes per IP
    let governor_conf = Box::new(
        GovernorConfigBuilder::default()
            .per_second(0) // Disable per-second limiting
            .burst_size(1) // Allow 1 request
            .period(Duration::from_secs(300)) // 5 minutes = 300 seconds
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .unwrap(),
    );

    // API routes (authenticated)
    let api_routes = Router::new()
        .route("/health", get(health_handler))
        .route("/version", get(version_handler))
        .route("/update", post(update_handler))
        .route("/restart", post(restart_handler))
        .route("/system/backup/status", get(backup_status_handler))
        .route("/system/backup/download", get(download_backup_handler))
        .route("/system/backup/trigger", post(trigger_backup_handler))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(
                    CorsLayer::new()
                        .allow_origin(AllowOrigin::predicate(|origin, _| {
                            // Allow localhost and 127.0.0.1 in various forms
                            let origin_str = origin.to_str().unwrap_or("");
                            origin_str.starts_with("http://localhost")
                                || origin_str.starts_with("https://localhost")
                                || origin_str.starts_with("http://127.0.0.1")
                                || origin_str.starts_with("https://127.0.0.1")
                        }))
                        .allow_methods(vec![
                            axum::http::Method::GET,
                            axum::http::Method::POST,
                            axum::http::Method::OPTIONS,
                        ])
                        .allow_headers(vec![
                            axum::http::header::AUTHORIZATION,
                            axum::http::header::CONTENT_TYPE,
                        ])
                        .allow_credentials(true),
                )
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    auth_middleware,
                ))
                .layer(GovernorLayer {
                    config: Box::leak(governor_conf),
                }),
        )
        .with_state(state.clone());

    // WebSocket route for mobile clients (no auth - handled by Holochain)
    let ws_route = Router::new()
        .route("/ws", get(ws_handler))
        .layer(TraceLayer::new_for_http());

    // Static file serving for React UI (no auth - public web access)
    let static_files = Router::new()
        .nest_service("/", ServeDir::new(&ui_path))
        .layer(TraceLayer::new_for_http());

    // Combine all routes
    let app = Router::new()
        .nest("/api", api_routes)
        .merge(ws_route)
        .fallback_service(static_files);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    
    info!(
        "🚀 OurBlock Hub Sidecar starting on http://{}",
        addr
    );
    info!("   Version: {}", std::env::var("APP_VERSION").unwrap_or_else(|_| "0.1.0".to_string()));
    info!("   Neighborhood: {}", neighborhood_name);
    info!("   mDNS: {}", mdns_hostname);
    info!("   Docker Compose: {}", std::env::var("DOCKER_COMPOSE_FILE").unwrap_or_else(|_| "/app/docker-compose.yaml".to_string()));
    info!("");
    info!("Available endpoints:");
    info!("   GET  /                     - React UI (static files)");
    info!("   GET  /ws                   - WebSocket for mobile clients");
    info!("   GET  /api/health           - Health check");
    info!("   GET  /api/version          - Version information");
    info!("   POST /api/update           - Trigger Docker update (auth required)");
    info!("   POST /api/restart          - Restart containers (auth required)");
    info!("");
    info!("⚡ Rate limit: 1 update per 5 minutes per IP");
    info!("🔐 Admin API: X-OurBlock-Admin-Key header required");
    info!("🌐 Discovery: Announcing as {}", mdns_hostname);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind to address");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .expect("Server failed");
}
