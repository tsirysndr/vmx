use actix_cors::Cors;
use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use awc::Client;
use mime_guess::from_path;
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "../../webui/dist/"]
struct Asset;

#[actix_web::get("/{_:.*}")]
async fn dist(path: web::Path<String>) -> impl Responder {
    handle_embedded_file(path.as_str())
}

fn handle_embedded_file(path: &str) -> HttpResponse {
    match Asset::get(path) {
        Some(content) => HttpResponse::Ok()
            .content_type(from_path(path).first_or_octet_stream().as_ref())
            .body(content.data.into_owned()),
        None => HttpResponse::NotFound().body("404 Not Found"),
    }
}

#[actix_web::get("/")]
async fn index() -> impl Responder {
    handle_embedded_file("index.html")
}

// Proxy to backend API server
#[actix_web::route(
    "/api/{_:.*}",
    method = "GET",
    method = "POST",
    method = "PUT",
    method = "DELETE",
    method = "PATCH",
    method = "HEAD",
    method = "OPTIONS"
)]
async fn api(req: HttpRequest, path: web::Path<String>, body: web::Bytes) -> impl Responder {
    let client = Client::default();

    let backend_url =
        std::env::var("VMX_BACKEND_URL").unwrap_or_else(|_| "http://localhost:8889".to_string());

    let target_url = if let Some(query_string) = req.uri().query() {
        format!("{}/{}?{}", backend_url, path.as_str(), query_string)
    } else {
        format!("{}/{}", backend_url, path.as_str())
    };

    // Forward the request to the target server
    let mut forwarded_req = client
        .request_from(target_url.as_str(), req.head())
        .no_decompress();

    for (header_name, header_value) in req.headers().iter() {
        if header_name != actix_web::http::header::HOST {
            forwarded_req =
                forwarded_req.insert_header((header_name.clone(), header_value.clone()));
        }
    }

    let mut res = match forwarded_req.send_body(body).await {
        Ok(res) => res,
        Err(e) => {
            eprintln!("Proxy error: {}", e);
            return HttpResponse::BadGateway().body(format!("Proxy error: {}", e));
        }
    };

    let mut client_resp = HttpResponse::build(res.status());

    for (header_name, header_value) in res.headers().iter() {
        if header_name != actix_web::http::header::CONNECTION
            && header_name != actix_web::http::header::TRANSFER_ENCODING
        {
            client_resp.insert_header((header_name.clone(), header_value.clone()));
        }
    }

    match res.body().await {
        Ok(body) => client_resp.body(body),
        Err(e) => {
            eprintln!("Error reading response body: {}", e);
            HttpResponse::BadGateway().body(format!("Error reading response: {}", e))
        }
    }
}

// SPA routes - serve index.html for client-side routing
#[actix_web::get("/{route:(login|profile|sshkeys|settings)}")]
async fn spa_routes() -> impl Responder {
    handle_embedded_file("index.html")
}

pub async fn run_http_server() -> std::io::Result<()> {
    let host = std::env::var("VMX_UI_HOST").unwrap_or("0.0.0.0".to_string());
    let port = std::env::var("VMX_UI_PORT").unwrap_or("8887".to_string());
    let addr = format!("{}:{}", host, port);

    let backend_url =
        std::env::var("VMX_BACKEND_URL").unwrap_or_else(|_| "http://localhost:8889".to_string());

    println!("Starting VMX UI at {}", addr);
    println!("Proxying /api/* requests to {}", backend_url);

    HttpServer::new(|| {
        let cors = Cors::permissive();
        App::new()
            .wrap(cors)
            .service(index)
            .service(api)
            .service(spa_routes)
            .service(dist)
    })
    .bind(addr)?
    .run()
    .await
}
