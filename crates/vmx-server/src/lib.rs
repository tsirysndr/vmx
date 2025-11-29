use std::sync::Arc;

use crate::{
    db::create_tables_in_database,
    resolver::HickoryDnsTxtResolver,
    storage::{SqliteSessionStore, SqliteStateStore},
    types::LoginRequest,
};
use actix_cors::Cors;
use actix_session::Session;
use actix_web::{middleware, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use atrium_identity::{
    did::{CommonDidResolver, CommonDidResolverConfig, DEFAULT_PLC_DIRECTORY_URL},
    handle::{AtprotoHandleResolver, AtprotoHandleResolverConfig},
};
use atrium_oauth::{
    AtprotoLocalhostClientMetadata, AuthorizeOptions, DefaultHttpClient, KnownScope, OAuthClient,
    OAuthClientConfig, OAuthResolverConfig, Scope,
};
use awc::Client;
use mime_guess::from_path;
use oauth2::{basic::BasicClient, CsrfToken, PkceCodeChallenge};
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, RedirectUrl, TokenResponse, TokenUrl,
};
use rust_embed::RustEmbed;
use serde::Deserialize;
use serde_json::json;
use sqlx::sqlite::SqliteConnectOptions;
use tokio::fs;

pub mod db;
pub mod entity;
pub mod repo;
pub mod resolver;
pub mod storage;
pub mod types;

#[derive(RustEmbed)]
#[folder = "../../webui/dist/"]
struct Asset;

type OAuthClientType = Arc<
    OAuthClient<
        SqliteStateStore,
        SqliteSessionStore,
        CommonDidResolver<DefaultHttpClient>,
        AtprotoHandleResolver<HickoryDnsTxtResolver, DefaultHttpClient>,
    >,
>;

#[derive(Clone)]
struct AppState {
    oauth_client: BasicClient,
}

#[derive(Deserialize)]
struct AuthCallback {
    code: String,
    state: String,
}

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

#[actix_web::post("/login")]
async fn login(
    body: Result<web::Json<LoginRequest>, actix_web::error::Error>,
    oauth_client: web::Data<OAuthClientType>,
) -> impl Responder {
    if let Err(e) = body {
        return HttpResponse::BadRequest().body(format!("Invalid login request: {}", e));
    }
    let request = body.unwrap().into_inner();

    let oauth_url = oauth_client
        .authorize(
            &request.handle,
            AuthorizeOptions {
                scopes: vec![
                    Scope::Known(KnownScope::Atproto),
                    Scope::Known(KnownScope::TransitionGeneric),
                ],
                ..Default::default()
            },
        )
        .await;

    match oauth_url {
        Ok(url) => HttpResponse::Ok().json(json!({"auth_url": url.to_string()})),
        Err(e) => HttpResponse::InternalServerError().body(format!("Failed to authorize: {}", e)),
    }
}

#[actix_web::get("/github/login")]
async fn login_with_github() -> impl Responder {
    let client_id =
        std::env::var("GITHUB_CLIENT_ID").unwrap_or_else(|_| "Ov23lilAaffKgAb4ZTmo".to_string());
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

    let client = BasicClient::new(ClientId::new(client_id))
        .set_client_secret(ClientSecret::new(
            "ddb3987ec8e72a5e47c515b0ff7cadebff984124".to_string(),
        ))
        .set_auth_uri(AuthUrl::new("https://github.com/login/oauth/authorize".to_string()).unwrap())
        .set_token_uri(
            TokenUrl::new("https://github.com/login/oauth/access_token".to_string()).unwrap(),
        )
        .set_redirect_uri(
            RedirectUrl::new("http://localhost:8887/oauth/github/callback".to_string()).unwrap(),
        );

    let (auth_url, csrf_token) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(oauth2::Scope::new("read:user".to_string()))
        .add_scope(oauth2::Scope::new("repo".to_string())) // add more scopes as needed
        .set_pkce_challenge(pkce_challenge)
        .url();

    HttpResponse::Ok().json(json!({"auth_url": auth_url.to_string()}))
}

pub async fn run_http_server() -> Result<(), anyhow::Error> {
    let config_dir = format!("{}/.vmx", dirs::home_dir().unwrap().to_str().unwrap());
    fs::create_dir_all(config_dir.clone()).await?;
    let db_path = format!("{}/atproto.sqlite", config_dir);
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true);

    let host = std::env::var("VMX_UI_HOST").unwrap_or("0.0.0.0".to_string());
    let port = std::env::var("VMX_UI_PORT").unwrap_or("8887".to_string());
    let addr = format!("{}:{}", host, port);

    let backend_url =
        std::env::var("VMX_BACKEND_URL").unwrap_or_else(|_| "http://localhost:8889".to_string());

    let pool = sqlx::SqlitePool::connect_with(options).await?;

    create_tables_in_database(&pool)
        .await
        .expect("Could not create the database");

    let http_client = Arc::new(DefaultHttpClient::default());

    let handle_resolver = CommonDidResolver::new(CommonDidResolverConfig {
        plc_directory_url: DEFAULT_PLC_DIRECTORY_URL.to_string(),
        http_client: http_client.clone(),
    });
    let handle_resolver = Arc::new(handle_resolver);

    let http_client = Arc::new(DefaultHttpClient::default());
    let config = OAuthClientConfig {
        client_metadata: AtprotoLocalhostClientMetadata {
            redirect_uris: Some(vec![String::from(format!(
                "http://127.0.0.1:{port}/oauth/callback"
            ))]),
            scopes: Some(vec![
                Scope::Known(KnownScope::Atproto),
                Scope::Known(KnownScope::TransitionGeneric),
            ]),
        },
        keys: None,
        resolver: OAuthResolverConfig {
            did_resolver: CommonDidResolver::new(CommonDidResolverConfig {
                plc_directory_url: DEFAULT_PLC_DIRECTORY_URL.to_string(),
                http_client: http_client.clone(),
            }),
            handle_resolver: AtprotoHandleResolver::new(AtprotoHandleResolverConfig {
                dns_txt_resolver: HickoryDnsTxtResolver::default(),
                http_client: http_client.clone(),
            }),
            authorization_server_metadata: Default::default(),
            protected_resource_metadata: Default::default(),
        },
        state_store: SqliteStateStore::new(pool.clone()),
        session_store: SqliteSessionStore::new(pool.clone()),
    };
    let client = Arc::new(OAuthClient::new(config).expect("failed to create OAuth client"));
    let arc_pool = Arc::new(pool.clone());

    println!("Starting VMX UI at {}", addr);
    println!("Proxying /api/* requests to {}", backend_url);

    HttpServer::new(move || {
        let cors = Cors::permissive();
        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(web::Data::new(client.clone()))
            .app_data(web::Data::new(arc_pool.clone()))
            .app_data(web::Data::new(handle_resolver.clone()))
            .service(index)
            .service(api)
            .service(login)
            .service(login_with_github)
            .service(spa_routes)
            .service(dist)
    })
    .bind(addr)?
    .run()
    .await?;

    Ok(())
}
