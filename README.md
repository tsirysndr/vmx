# vmx

A powerful command-line tool and HTTP API for managing and running headless
virtual machines using QEMU. Built with Deno and TypeScript, vmx provides a
Docker-like experience for VM management with OCI registry support.

## Features

### 🚀 Core Functionality

- **Headless VM Management** - Run VMs in the background without GUI overhead
- **QEMU Integration** - Leverages QEMU for robust virtualization on both x86_64
  and ARM64 architectures
- **Docker-like CLI** - Familiar commands for VM lifecycle management (run,
  start, stop, ps, rm, etc.)
- **Configuration Files** - TOML-based configuration for reproducible VM setups
- **Multiple Input Sources** - Boot from local ISOs, remote URLs, or OCI
  registry images

### 📦 OCI Registry Support

- **Pull & Push** - Store and retrieve VM images from OCI-compliant registries
  (GitHub Container Registry, Docker Hub, etc.)
- **Image Management** - List, tag, and remove local VM images
- **Authentication** - Secure login/logout for private registries
- **Cross-platform** - Automatic architecture detection and handling
  (amd64/arm64)

### 🌐 Networking

- **Bridge Networking** - Create and manage network bridges for VM connectivity
- **Port Forwarding** - Easy SSH and service access with flexible port mapping
- **Multiple Network Modes** - Support for various QEMU networking
  configurations

### 💾 Storage & Volumes

- **Volume Management** - Create, list, inspect, and delete persistent volumes
- **Multiple Disk Formats** - Support for qcow2 and raw disk images
- **Automatic Provisioning** - Volumes are created automatically from base
  images
- **Flexible Sizing** - Configurable disk sizes for different workloads

### 🔧 Advanced Features

- **Detached Mode** - Run VMs in the background as daemon processes
- **Live Logs** - Stream VM output and follow logs in real-time
- **VM Inspection** - Detailed information about running and stopped VMs
- **Resource Configuration** - Customizable CPU, memory, and disk settings
- **ARM64 & x86_64 Support** - Native support for both architectures with UEFI
  firmware

### 🌍 HTTP API

- **RESTful API** - Full-featured HTTP API for programmatic VM management
- **Bearer Authentication** - Secure API access with token-based auth
- **Machines Endpoint** - Create, start, stop, restart, and remove VMs via API
- **Images Endpoint** - List and query VM images
- **Volumes Endpoint** - Manage persistent storage volumes
- **CORS Support** - Cross-origin requests for web-based tools

## Installation

```bash
# Install with Deno
 deno install -A -r -f -g --config deno.json ./main.ts -n vmx
```

### Requirements

- [Deno](https://deno.com) runtime
- [QEMU](https://www.qemu.org/) installed on your system
  - macOS: `brew install qemu`
  - Linux: `apt-get install qemu-system` or `yum install qemu-kvm`

## Quick Start

### Initialize Configuration

Create a default VM configuration file:

```bash
vmx init
```

This creates a `vmconfig.toml` file with sensible defaults.

### Run a VM from ISO

```bash
# From a local ISO file
vmx /path/to/ubuntu.iso

# Download and run from URL
vmx https://cdimage.ubuntu.com/releases/24.04/release/ubuntu-24.04.3-live-server-arm64.iso

# From OCI registry
vmx ghcr.io/tsirysndr/ubuntu:24.04
```

### Pull and Run from Registry

```bash
# Pull an image
vmx pull ghcr.io/tsirysndr/ubuntu:24.04

# Run the image
vmx run ghcr.io/tsirysndr/ubuntu:24.04

# Run with custom resources
vmx run ghcr.io/tsirysndr/ubuntu:24.04 -m 4G -C 4 -d
```

## Usage

### VM Lifecycle Management

```bash
# List running VMs
vmx ps

# List all VMs (including stopped)
vmx ps --all

# Start a VM
vmx start my-vm

# Stop a VM
vmx stop my-vm

# Restart a VM
vmx restart my-vm

# Remove a VM
vmx rm my-vm

# View VM logs
vmx logs my-vm

# Follow logs in real-time
vmx logs -f my-vm

# Inspect VM details
vmx inspect my-vm
```

### Image Management

```bash
# List local images
vmx images

# Pull from registry
vmx pull ghcr.io/tsirysndr/ubuntu:24.04

# Push to registry
vmx push ghcr.io/tsirysndr/my-vm:latest

# Tag an image
vmx tag my-vm ghcr.io/tsirysndr/my-vm:v1.0

# Remove an image
vmx rmi ghcr.io/tsirysndr/ubuntu:24.04
```

### Registry Authentication

```bash
# Login to registry
vmx login -u username ghcr.io

# Login with password from stdin
echo "password" | vmx login -u username ghcr.io

# Logout
vmx logout ghcr.io
```

### Volume Management

```bash
# List volumes
vmx volumes

# Create and attach a volume to VM
vmx run ubuntu:24.04 -v my-data

# Inspect a volume
vmx volume inspect my-data

# Remove a volume
vmx volume rm my-data
```

### Advanced Options

```bash
# Run with custom resources
vmx run ubuntu:24.04 \
  --cpu host \
  --cpus 4 \
  --memory 4G \
  --detach

# With port forwarding (SSH on port 2222)
vmx run ubuntu:24.04 -p 2222:22

# With bridge networking
vmx run ubuntu:24.04 --bridge br0

# With persistent disk
vmx run ubuntu:24.04 \
  --image /path/to/disk.img \
  --size 40G \
  --disk-format qcow2
```

## Configuration File

The `vmconfig.toml` file allows you to define default VM settings:

```toml
[vm]
iso = "https://cdimage.ubuntu.com/releases/24.04/release/ubuntu-24.04.3-live-server-arm64.iso"
cpu = "host"
cpus = 2
memory = "2G"
image = "./vm-disk.img"
disk_format = "raw"
size = "20G"

[network]
bridge = "br0"
port_forward = "2222:22"

[options]
detach = false
```

## HTTP API

Start the API server:

```bash
# Start on default port (8889)
vmx serve

# Start on custom port
vmx serve --port 3000

# With custom API token
export VMX_API_TOKEN=your-secret-token
vmx serve
```

### API Endpoints

#### Machines (VMs)

- `GET /machines` - List all machines
- `GET /machines?all=true` - List all machines including stopped
- `POST /machines` - Create a new machine
- `GET /machines/:id` - Get machine details
- `DELETE /machines/:id` - Remove a machine
- `POST /machines/:id/start` - Start a machine
- `POST /machines/:id/stop` - Stop a machine
- `POST /machines/:id/restart` - Restart a machine

#### Images

- `GET /images` - List all images
- `GET /images/:id` - Get image details

#### Volumes

- `GET /volumes` - List all volumes
- `GET /volumes/:id` - Get volume details
- `POST /volumes` - Create a new volume
- `DELETE /volumes/:id` - Remove a volume

### API Authentication

All API requests require a Bearer token:

```bash
curl -H "Authorization: Bearer your-token" http://localhost:8889/machines
```

### Example API Usage

```bash
# Create a machine
curl -X POST http://localhost:8889/machines \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "ubuntu:24.04",
    "memory": "4G",
    "cpus": 4,
    "portForward": ["2222:22"]
  }'

# Start a machine
curl -X POST http://localhost:8889/machines/{id}/start \
  -H "Authorization: Bearer your-token"

# List all machines
curl http://localhost:8889/machines \
  -H "Authorization: Bearer your-token"
```

## Architecture Support

vmx automatically detects and adapts to your system architecture:

- **x86_64 / amd64** - Full QEMU system emulation
- **ARM64 / aarch64** - Native Apple Silicon and ARM server support with UEFI
  firmware

## Examples

### Development Environment

```bash
# Initialize configuration
vmx init

# Edit vmconfig.toml to your needs
# Then start the VM
vmx

# SSH into the VM (port forwarding configured)
ssh -p 2222 user@localhost
```

### CI/CD Integration

```bash
# Pull a pre-configured image
vmx pull ghcr.io/company/test-env:latest

# Run tests in detached mode
vmx run ghcr.io/company/test-env:latest -d

# Execute tests and cleanup
vmx stop test-vm
vmx rm test-vm
```

### Multi-VM Setup

```bash
# Start database VM
vmx run postgres:14 -d -p 5432:5432 -v pgdata

# Start application VM
vmx run app:latest -d -p 8080:8080

# List all running VMs
vmx ps
```

## License

Mozilla Public License 2.0 (MPL-2.0)

Copyright (c) 2025 Tsiry Sandratraina

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Links

- [Repository](https://github.com/tsirysndr/vmx)
- [Issue Tracker](https://github.com/tsirysndr/vmx/issues)
- [JSR Package](https://jsr.io/@tsiry/vmx)
