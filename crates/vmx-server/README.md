# VMX Server

A static file server with API proxy functionality built with Actix Web.

## Features

- 🚀 **Static File Serving** - Serves embedded web UI from `../../webui/dist/`
- 🔄 **API Proxy** - Forwards all `/api/*` requests to a configurable backend
- 🌐 **CORS Support** - Permissive CORS configuration for development
- ⚙️ **Configurable** - Backend URL, host, and port via environment variables

## Architecture

```
Client Request → VMX Server (8887) → Backend API (8889)
                 ↓
            Static Files (webui)
```

## Getting Started

### 1. Build the Server

```bash
cargo build -p vmx-server --release
```

### 2. Set Environment Variables (Optional)

```bash
# UI Server Configuration
export VMX_UI_HOST="0.0.0.0"      # Default: 0.0.0.0
export VMX_UI_PORT="8887"         # Default: 8887

# Backend API Configuration
export VMX_BACKEND_URL="http://localhost:8889"  # Default: http://localhost:8889
```

### 3. Run the Server

```bash
cargo run -p vmx-server
```

The server will start and display:
```
Starting VMX UI at 0.0.0.0:8887
Proxying /api/* requests to http://localhost:8889
```

## API Proxy

### Supported Methods

The proxy forwards all standard HTTP methods:
- GET
- POST
- PUT
- DELETE
- PATCH
- HEAD
- OPTIONS

### Request Forwarding

The proxy forwards:
- ✅ Request method
- ✅ Request path (preserves `/api/` prefix)
- ✅ Query parameters
- ✅ Request headers (except HOST)
- ✅ Request body

### Response Forwarding

The proxy returns:
- ✅ Response status code
- ✅ Response headers (except CONNECTION, TRANSFER-ENCODING)
- ✅ Response body

### Example Requests

#### GET Request
```bash
curl http://localhost:8887/api/users
# Proxied to: http://localhost:8889/api/users
```

#### GET with Query Parameters
```bash
curl http://localhost:8887/api/users?page=1&limit=10
# Proxied to: http://localhost:8889/api/users?page=1&limit=10
```

#### POST Request
```bash
curl -X POST http://localhost:8887/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
# Proxied to: http://localhost:8889/api/users
```

#### PUT Request
```bash
curl -X PUT http://localhost:8887/api/users/123 \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe"}'
# Proxied to: http://localhost:8889/api/users/123
```

#### DELETE Request
```bash
curl -X DELETE http://localhost:8887/api/users/123
# Proxied to: http://localhost:8889/api/users/123
```

## Testing

### Test Backend Server

A test backend server is included to help you test the proxy functionality:

```bash
# Terminal 1: Start the test backend
cargo run --example test_backend -p vmx-server

# Terminal 2: Start vmx-server
cargo run -p vmx-server

# Terminal 3: Test the proxy
curl http://localhost:8887/api/health
curl http://localhost:8887/api/users
```

The test backend provides these endpoints:
- `GET /api/health` - Health check
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/echo?param=value` - Echo query parameters

## Routes

Routes are evaluated in this order:

1. `GET /` → `index.html`
2. `* /api/*` → Proxy to backend
3. `GET /{path}` → Static file or `index.html` (SPA fallback)

This allows:
- API requests to be proxied
- Static assets to be served
- SPA routing to work (all non-API routes serve index.html)

## Error Handling

The proxy handles errors gracefully:

| Error Type | Response | Details |
|------------|----------|---------|
| Connection Failed | 502 Bad Gateway | Backend unreachable |
| Network Error | 502 Bad Gateway | Network issue during request |
| Response Read Error | 502 Bad Gateway | Failed to read backend response |

All errors are logged to stderr with `eprintln!`.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VMX_UI_HOST` | `0.0.0.0` | Host to bind the server |
| `VMX_UI_PORT` | `8887` | Port to bind the server |
| `VMX_BACKEND_URL` | `http://localhost:8889` | Backend API URL for proxying |

### Changing Backend URL

You can change the backend URL in three ways:

#### 1. Environment Variable (Recommended)
```bash
VMX_BACKEND_URL="http://api.example.com" cargo run -p vmx-server
```

#### 2. Code Modification
Edit `src/lib.rs` and change the default:
```rust
let backend_url = std::env::var("VMX_BACKEND_URL")
    .unwrap_or_else(|_| "http://your-backend:8080".to_string());
```

## Dependencies

```toml
[dependencies]
actix = "0.13.5"
actix-cors = "0.7.1"
actix-web = "4.12.0"
awc = "3.5.2"           # HTTP client for proxy
mime_guess = "2.0.5"
rust-embed = "8.9.0"    # Embed static files
```

## Implementation Details

### Proxy Handler

Located in `src/lib.rs`, the `api()` function:

1. Extracts the request path and query parameters
2. Builds the target URL using `VMX_BACKEND_URL`
3. Creates an HTTP client request matching the original method
4. Forwards headers (except HOST)
5. Sends the request with the original body
6. Receives the response
7. Forwards response headers and body back to client

### Static File Serving

Uses `rust-embed` to embed the webui at compile time:
- Production builds include files directly in binary
- Debug builds use `debug-embed` feature to serve files from disk

## Production Considerations

For production deployments, consider:

1. **Connection Pooling** - Create a persistent `awc::Client` with connection pooling
2. **Timeouts** - Configure request timeouts
3. **Retry Logic** - Implement retry for transient failures
4. **Logging** - Use a proper logging framework (e.g., `tracing`)
5. **Metrics** - Add request/response metrics
6. **Rate Limiting** - Implement rate limiting for API endpoints
7. **Authentication** - Add authentication/authorization middleware
8. **HTTPS** - Use TLS in production
9. **Health Checks** - Add health check endpoint

## Troubleshooting

### Backend Connection Refused
```
Proxy error: error sending request for url (http://localhost:8889/api/users)
```
**Solution**: Ensure your backend is running on the configured port (default 8889).

### CORS Issues
The server uses `Cors::permissive()` which allows all origins. For production, configure CORS properly:
```rust
let cors = Cors::default()
    .allowed_origin("https://yourdomain.com")
    .allowed_methods(vec!["GET", "POST"])
    .allowed_headers(vec![header::AUTHORIZATION, header::ACCEPT])
    .allowed_header(header::CONTENT_TYPE);
```

### 404 for Static Files
Ensure the webui is built before running:
```bash
cd webui
npm install
npm run build
cd ..
cargo run -p vmx-server
```

## License

MPL-2.0