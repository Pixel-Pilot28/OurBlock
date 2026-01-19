# OurBlock Development Roadmap

Track completed features, current work, and future plans for OurBlock.

Last Updated: January 2025

---

## ✅ Completed (v0.3.0 - Hybrid P2P Architecture)

### Task A: Hub Infrastructure
- [x] Home Assistant Add-on structure
- [x] Rust sidecar as static file server
- [x] mDNS discovery (ourblock.local)
- [x] WebSocket gateway for mobile
- [x] Membrane proof validation in genesis_self_check
- [x] DNA properties for neighborhood_uid
- [x] Docker Compose deployment configuration
- [x] Architecture documentation

### Task B: Hub Invite Factory
- [x] OURBLOCK_V1 invite code format specification
- [x] `generate_invitation()` coordinator function
- [x] Cryptographic signature generation
- [x] Invitation tracking on Hub's source chain
- [x] `revoke_invitation()` function
- [x] `list_invitations()` function
- [x] `validate_invitation_code()` pre-validation helper
- [x] Dual format support (OURBLOCK_V1 + legacy MessagePack)
- [x] Invitation system documentation

### Task C: Client Join Logic
- [x] `JoinNeighborhood.tsx` React component
- [x] `inviteCode.ts` parsing utilities
- [x] AdminWebsocket integration for app installation
- [x] Real-time validation with visual feedback
- [x] Progress tracking during installation
- [x] Error handling and user-friendly messages
- [x] Environment variable configuration
- [x] Landing page with join CTA
- [x] Router integration (/join route)
- [x] Testing documentation

### Core Features (v0.1.0 - v0.2.0)
- [x] Profile management with vouching system
- [x] Block Feed (posts with reactions and comments)
- [x] Tool Shed (shared items with DHT image storage)
- [x] Events system (RSVP and capacity management)
- [x] Shared Spaces (amenity reservation)
- [x] Chat (private and group messaging)
- [x] Community switcher (multi-neighborhood support)
- [x] Settings panel (profile + system)
- [x] Data backup/restore
- [x] Docker sidecar for auto-updates

---

## 🚧 In Progress (v0.4.0)

### Priority 1: Hub Admin UI
**Goal**: Web interface for managing invitations

**Tasks:**
- [ ] Create `/admin` route and layout
- [ ] Generate invitation form
  - Input: neighbor name
  - Optional: voucher selection
  - Output: OURBLOCK_V1 code + QR code
- [ ] Invitation list component
  - Table view with filters (active, expired, revoked)
  - Search by neighbor name
  - Status badges (valid, expired, revoked)
- [ ] Revoke invitation button
- [ ] QR code generation (qrcode.react)
- [ ] Copy to clipboard functionality
- [ ] Share via email/SMS links
- [ ] Analytics dashboard
  - Total invitations generated
  - Acceptance rate
  - Active members over time

**Dependencies:**
- Need to call coordinator functions from UI
- AppWebsocket connection for zome calls
- May need new coordinator functions for stats

**Estimated Timeline**: 1-2 weeks

### Priority 2: Network Configuration
**Goal**: Proper bootstrap server and NAT traversal setup

**Tasks:**
- [ ] Configure conductor to use global bootstrap server
- [ ] Set up signal relay for NAT traversal
- [ ] Test cross-network connectivity (different WiFi networks)
- [ ] Document network configuration options
- [ ] Add bootstrap server health checks
- [ ] Fallback bootstrap servers configuration

**Dependencies:**
- Holochain conductor network config
- Signal server deployment (or use public Holochain servers)

**Estimated Timeline**: 1 week

### Priority 3: Testing and Documentation
**Goal**: Ensure join flow works end-to-end

**Tasks:**
- [ ] End-to-end testing with real invites
- [ ] Multi-device testing (desktop, mobile web)
- [ ] Cross-network testing (different locations)
- [ ] Security testing (expired codes, tampered codes, etc.)
- [ ] Performance testing (large neighborhoods)
- [ ] User acceptance testing with real neighbors
- [ ] Video tutorial for joining

**Estimated Timeline**: 1-2 weeks

---

## 📋 Planned (v0.5.0+)

### Mobile App (React Native)
**Goal**: Full peer autonomy on iOS and Android

**Features:**
- React Native UI matching web interface
- QR code scanner for invite codes
- Native Holochain conductor integration
- Biometric authentication for keystore
- Push notifications for events and messages
- Offline-first with local data persistence
- Camera integration for profile photos
- Geolocation for neighborhood boundaries

**Technical Stack:**
- React Native 0.72+
- @holochain/client
- react-native-camera (QR scanner)
- react-native-biometrics
- Holochain conductor as native module

**Challenges:**
- Holochain conductor mobile integration
- App store approval (decentralized apps)
- Background process management
- Battery optimization
- Keystore security on mobile

**Estimated Timeline**: 2-3 months

### QR Code Integration (Web)
**Goal**: Scan invite codes instead of typing

**Features:**
- Camera permission request
- QR code scanner component (jsQR or html5-qrcode)
- Live preview with scanning feedback
- Automatic code extraction and validation
- Fall back to manual entry if camera fails

**Technical Stack:**
- html5-qrcode or jsQR
- navigator.mediaDevices.getUserMedia
- Canvas for QR detection

**Estimated Timeline**: 1 week

### Enhanced Revocation System
**Goal**: Real-time revocation propagation

**Features:**
- Publish revocations to DHT
- Real-time revocation checks in genesis_self_check
- Revocation list caching for performance
- Grace period for revoked codes (e.g., 1 hour)
- Notifications to revoked users
- Audit trail for revocations

**Technical Approach:**
- New entry type: `Revocation`
- Link from invitation to revocation
- genesis_self_check queries DHT for revocations
- Cache revocation list locally

**Challenges:**
- DHT query performance in genesis_self_check
- Handling offline revocations
- Synchronization delays

**Estimated Timeline**: 2 weeks

### Multi-Hub Support
**Goal**: Failover and load balancing across multiple Hubs

**Features:**
- Auto-discovery of multiple Hubs in neighborhood
- Health monitoring for each Hub
- Automatic failover to backup Hub
- Load balancing for web users
- Hub priority configuration
- Sync state between Hubs

**Technical Approach:**
- mDNS discovery of multiple _ourblock._tcp services
- WebSocket connection pooling
- Health check pings
- Automatic reconnection logic

**Challenges:**
- Consistent state across Hubs
- Split-brain scenarios
- Network partition handling

**Estimated Timeline**: 3-4 weeks

### Bootstrap Server Infrastructure
**Goal**: Reliable peer discovery infrastructure

**Features:**
- Deploy own bootstrap servers (3+ regions)
- Load balancing across bootstrap servers
- Monitoring and analytics dashboard
- Automatic failover to backup servers
- Custom bootstrap server for private networks
- Bootstrap server health checks

**Technical Stack:**
- Holochain bootstrap server (Rust)
- Kubernetes for orchestration
- Prometheus + Grafana for monitoring
- CDN for global distribution

**Estimated Timeline**: 2-3 weeks

---

## 🔮 Future Ideas (v1.0+)

### Advanced Features
- [ ] **Neighborhood Boundaries**: Geofencing with map integration
- [ ] **Skill Sharing**: Directory of neighbor skills and services
- [ ] **Local Marketplace**: Buy/sell/trade items within neighborhood
- [ ] **Emergency Alerts**: Broadcast urgent messages to all neighbors
- [ ] **Photo Gallery**: Shared neighborhood photo albums
- [ ] **Document Library**: Share HOA docs, neighborhood guidelines, etc.
- [ ] **Polls and Voting**: Neighborhood decisions and surveys
- [ ] **Maintenance Requests**: Track shared space upkeep
- [ ] **Guest Access**: Temporary codes for visitors/renters
- [ ] **Sub-Groups**: Private circles within the neighborhood (e.g., book club)

### Technical Improvements
- [ ] **Progressive Web App**: Install as native app on desktop/mobile
- [ ] **Service Worker**: Better offline support
- [ ] **IndexedDB Caching**: Cache DHT data locally
- [ ] **WebRTC**: Direct peer-to-peer connections for chat
- [ ] **End-to-End Encryption**: Encrypted messages and files
- [ ] **File Sharing**: Share PDFs, photos, documents via DHT
- [ ] **Voice/Video Calls**: WebRTC-based calling
- [ ] **Real-time Presence**: See who's online
- [ ] **Read Receipts**: Message delivery and read status
- [ ] **Typing Indicators**: Real-time typing status

### Deployment Options
- [ ] **One-Click Deploy**: Heroku, DigitalOcean App Platform, etc.
- [ ] **Kubernetes Helm Chart**: Enterprise deployment
- [ ] **Snap Package**: Ubuntu/Linux easy install
- [ ] **Windows Installer**: .exe for Windows Hub hosting
- [ ] **macOS App**: Native macOS Hub app
- [ ] **NixOS Module**: Declarative NixOS configuration

### Integrations
- [ ] **Nextdoor Import**: Migrate from Nextdoor
- [ ] **Google Calendar**: Sync neighborhood events
- [ ] **Ring Doorbell**: Share security camera footage
- [ ] **Weather API**: Local weather in feed
- [ ] **Local News**: RSS feed integration
- [ ] **Home Assistant Sensors**: Share device states
- [ ] **IFTTT/Zapier**: Automation integrations

---

## Version History

### v0.3.0 (January 2025) - Hybrid P2P Architecture
- Hybrid P2P architecture with Hub and User Apps
- Home Assistant Add-on deployment
- OURBLOCK_V1 invite code system
- Zero-config join flow
- mDNS discovery

### v0.2.0 (December 2024) - Enhanced Features
- Events system with RSVP
- Shared Spaces reservation
- Community switcher
- Settings panel
- Backup/restore

### v0.1.0 (November 2024) - Initial Release
- Profile management
- Block Feed
- Tool Shed
- Basic chat
- Docker deployment

---

## Contributing

Want to contribute to OurBlock? Here's how:

1. **Pick a task** from the "Planned" section
2. **Open an issue** to discuss your approach
3. **Create a branch** with a descriptive name
4. **Submit a PR** with clear description and tests
5. **Respond to feedback** and iterate

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

---

## Prioritization Framework

Features are prioritized based on:

1. **User Value**: Does it solve a real neighbor problem?
2. **Technical Complexity**: Can we implement it with current stack?
3. **Dependencies**: What needs to be done first?
4. **Community Requests**: What are users asking for?
5. **Strategic Alignment**: Does it fit our P2P vision?

**Current Focus**: Getting the join flow production-ready (Hub Admin UI, network config, testing).

---

## Questions or Suggestions?

- Open an issue on GitHub
- Join the Holochain Discord
- Email the maintainers

Let's build the neighborhood network of the future! 🏘️
