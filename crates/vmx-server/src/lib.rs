use std::{collections::HashMap, env, str::FromStr, sync::Arc};

use crate::{
    auth::{decode_authorization_header, read_token_file, validate_token},
    db::create_tables_in_database,
    storage::SqliteSessionStore,
    types::{AccessToken, Claims, GithubProfile, LoginRequest},
};
use actix_cors::Cors;
use actix_session::{storage::CookieSessionStore, Session, SessionMiddleware};
use actix_web::{
    cookie::Key, middleware, web, App, HttpRequest, HttpResponse, HttpServer, Responder,
};
use awc::Client;
use dotenv::dotenv;
use jacquard::api::app_bsky::actor::profile::Profile;
use jacquard::prelude::XrpcClient;
use jacquard::{api::com_atproto::repo::list_records::ListRecords, client::AgentSessionExt};
use jacquard::{
    client::Agent, identity::JacquardResolver, oauth::client::OAuthClient, types::did::Did,
};
use jacquard_oauth::{
    atproto::AtprotoClientMetadata,
    scopes::{Scope, TransitionScope},
    types::{AuthorizeOptions, CallbackParams},
};
use mime_guess::from_path;
use oauth2::{
    basic::BasicClient, AuthorizationCode, CsrfToken, EndpointNotSet, EndpointSet,
    PkceCodeChallenge, PkceCodeVerifier, TokenResponse,
};
use oauth2::{AuthUrl, ClientId, ClientSecret, RedirectUrl, TokenUrl};
use rust_embed::RustEmbed;
use serde_json::json;
use sqlx::{sqlite::SqliteConnectOptions, Pool, Sqlite};
use tokio::{fs, sync::Mutex};
use tracing_subscriber::fmt::format::Format;
use url::Url;

pub mod auth;
pub mod db;
pub mod entity;
pub mod repo;
pub mod storage;
pub mod types;

#[derive(RustEmbed)]
#[folder = "../../webui/dist/"]
struct Asset;

type OauthClientType = OAuthClient<JacquardResolver, SqliteSessionStore>;

#[derive(Clone)]
struct AppState {
    oauth_client:
        BasicClient<EndpointSet, EndpointNotSet, EndpointNotSet, EndpointNotSet, EndpointSet>,
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

#[actix_web::get("/api/accesstoken")]
async fn get_access_token(
    query: web::Query<HashMap<String, String>>,
    kv: web::Data<Arc<Mutex<HashMap<String, String>>>>,
) -> HttpResponse {
    let id = query["id"].clone();

    if id.is_empty() {
        tracing::info!("Empty id provided");
        return HttpResponse::BadRequest().finish();
    }

    let kv_mutex = kv.lock().await;
    let access_token = kv_mutex.get(&id);

    if access_token.is_none() {
        tracing::info!("Access token not found for id: {}", id);
        return HttpResponse::Unauthorized().finish();
    }

    let access_token = access_token.unwrap();
    let access_token = access_token.clone();

    drop(kv_mutex);

    let mut kv_mutex = kv.lock().await;
    kv_mutex.remove(&id);

    HttpResponse::Ok().json(AccessToken { access_token })
}

#[actix_web::get("/api/sshkeys")]
async fn sshkeys(
    oauth: web::Data<Arc<OauthClientType>>,
    pool: web::Data<Arc<Pool<Sqlite>>>,
) -> impl Responder {
    let did = Did::new("did:plc:7vdlgi2bflelz7mmuxoqjfcr".into());
    if did.is_err() {
        return HttpResponse::BadRequest().body("Invalid DID");
    }
    let did = did.unwrap();

    let auth_session = repo::auth_session::get_by_did(&pool, did.as_str()).await;
    if auth_session.is_err() {
        return HttpResponse::Unauthorized().body("Unauthorized");
    }

    let auth_session = auth_session.unwrap();

    if auth_session.is_none() {
        return HttpResponse::Unauthorized().body("Unauthorized");
    }

    let auth_session = auth_session.unwrap();
    let auth_session: serde_json::Value = serde_json::from_str(&auth_session.session).unwrap();
    let session = oauth
        .restore(&did, auth_session["session_id"].as_str().unwrap())
        .await;

    if let Err(err) = session {
        tracing::error!("Failed to restore session: {}", err);
        return HttpResponse::InternalServerError().body("Can't restore session");
    }

    let session = session.unwrap();

    let agent = Agent::new(session);
    let info = agent.info().await;
    if info.is_none() {
        tracing::error!("Failed to get agent info");
        return HttpResponse::InternalServerError().body("Can't get agent info");
    }
    let info = info.unwrap();
    tracing::info!(did = ?info, "ATProto login successful for DID");

    let did = info.0.replace("at://", "");
    let response = agent
        .send(
            ListRecords::new()
                .limit(100)
                .repo(did)
                .collection("sh.tangled.publicKey".to_string())
                .build(),
        )
        .await;

    if response.is_err() {
        tracing::error!("Failed to get public keys: {}", response.err().unwrap());
        return HttpResponse::InternalServerError().body("Can't get public key");
    }

    let response = response.unwrap();
    let output = response.into_output().unwrap();
    HttpResponse::Ok().json(output.records)
}

#[actix_web::get("/api/me")]
async fn me(
    req: HttpRequest,
    oauth: web::Data<Arc<OauthClientType>>,
    pool: web::Data<Arc<Pool<Sqlite>>>,
) -> impl Responder {
    let did = decode_authorization_header(req.headers());

    if let Err(err) = did {
        return HttpResponse::Unauthorized().body(err.to_string());
    }

    let did = did.unwrap().unwrap();

    if !did.starts_with("did:") {
        return HttpResponse::Ok().json(json!({
            "user": "admin"
        }));
    }

    let did = Did::new(did.as_str().into());
    if did.is_err() {
        return HttpResponse::BadRequest().body("Invalid DID");
    }
    let did = did.unwrap();

    let auth_session = repo::auth_session::get_by_did(&pool, did.as_str()).await;
    if auth_session.is_err() {
        return HttpResponse::Unauthorized().body("Unauthorized");
    }

    let auth_session = auth_session.unwrap();

    if auth_session.is_none() {
        return HttpResponse::Unauthorized().body("Unauthorized");
    }

    let auth_session = auth_session.unwrap();
    let auth_session: serde_json::Value = serde_json::from_str(&auth_session.session).unwrap();
    let session = oauth
        .restore(&did, auth_session["session_id"].as_str().unwrap())
        .await;

    if let Err(err) = session {
        tracing::error!("Failed to restore session: {}", err);
        return HttpResponse::InternalServerError().body("Can't restore session");
    }

    let session = session.unwrap();

    let agent = Agent::new(session);
    let info = agent.info().await;
    if info.is_none() {
        tracing::error!("Failed to get agent info");
        return HttpResponse::InternalServerError().body("Can't get agent info");
    }
    let info = info.unwrap();
    tracing::info!(did = ?info, "ATProto login successful for DID");

    let uri = format!("at://{}/app.bsky.actor.profile/self", info.0);
    let uri = Profile::uri(uri).unwrap();
    let response = agent.fetch_record(&uri).await;

    if response.is_err() {
        tracing::error!("Failed to get profile: {}", response.err().unwrap());
        return HttpResponse::InternalServerError().body("Can't get profile");
    }

    let response = response.unwrap();
    let record: Profile<'_> = response.into();
    HttpResponse::Ok().json(record)
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

    let mut authorization = String::new();
    for (header_name, header_value) in req.headers().iter() {
        if header_name != actix_web::http::header::HOST {
            forwarded_req =
                forwarded_req.insert_header((header_name.clone(), header_value.clone()));
        }

        if header_name == actix_web::http::header::AUTHORIZATION {
            authorization = header_value.to_str().unwrap_or("").to_string();
        }
    }

    let token = env::var("VMX_TOKEN").unwrap();
    authorization = authorization.replace("Bearer ", "").replace("bearer ", "");

    if token != authorization {
        if validate_token(&authorization).is_ok() {
            forwarded_req = forwarded_req.insert_header((
                actix_web::http::header::AUTHORIZATION,
                format!("Bearer {}", token),
            ));
        } else {
            return HttpResponse::Unauthorized().body("Invalid token");
        }
    }

    let mut res = match forwarded_req.send_body(body).await {
        Ok(res) => res,
        Err(e) => {
            tracing::error!("Proxy error: {}", e);
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
            tracing::error!("Error reading response body: {}", e);
            HttpResponse::BadGateway().body(format!("Error reading response: {}", e))
        }
    }
}

// SPA routes - serve index.html for client-side routing
#[actix_web::get("/{route:(login|profile|sshkeys|settings)}")]
async fn spa_routes() -> impl Responder {
    handle_embedded_file("index.html")
}

#[actix_web::get("/oauth/login")]
async fn login(
    query: web::Query<LoginRequest>,
    oauth: web::Data<Arc<OauthClientType>>,
) -> impl Responder {
    let query = query.into_inner();
    let oauth_url = oauth
        .start_auth(query.handle.clone(), AuthorizeOptions::default())
        .await;

    match oauth_url {
        Ok(url) => HttpResponse::Found()
            .append_header(("Location", url.to_string()))
            .finish(),
        Err(e) => HttpResponse::InternalServerError().body(format!("Failed to authorize: {}", e)),
    }
}

#[actix_web::get("/github/login")]
async fn login_with_github(session: Session, state: web::Data<AppState>) -> impl Responder {
    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
    session
        .insert("pkce_verifier", pkce_verifier.secret())
        .unwrap();

    let (auth_url, _csrf_token) = state
        .oauth_client
        .authorize_url(CsrfToken::new_random)
        .add_scope(oauth2::Scope::new("read:user".to_string()))
        .add_scope(oauth2::Scope::new("repo".to_string())) // add more scopes as needed
        .set_pkce_challenge(pkce_challenge)
        .url();

    HttpResponse::Found()
        .append_header(("Location", auth_url.to_string()))
        .finish()
}

#[actix_web::get("/oauth/github/callback")]
async fn oauth_github_callback(
    query: web::Query<HashMap<String, String>>,
    session: Session,
    kv: web::Data<Arc<Mutex<HashMap<String, String>>>>,
    state: web::Data<AppState>,
) -> impl Responder {
    tracing::info!("Callback received with query params: {:?}", query);

    if query.get("state").is_none() {
        tracing::info!("No state parameter in callback");
        return HttpResponse::Forbidden().body("No state parameter");
    }

    let pkce_verifier_str = session.get("pkce_verifier").unwrap().unwrap();
    let pkce_verifier = PkceCodeVerifier::new(pkce_verifier_str);

    match query.get("code") {
        Some(code) => {
            let token_result = state
                .oauth_client
                .exchange_code(AuthorizationCode::new(code.to_string()))
                .set_pkce_verifier(pkce_verifier)
                .request_async(&reqwest::Client::new())
                .await;

            if token_result.is_err() {
                tracing::error!("Failed to exchange code for token");
                return HttpResponse::InternalServerError().finish();
            }

            let gh_token = token_result.unwrap().access_token().secret().clone();
            let client = reqwest::Client::new();
            let response = client
                .get("https://api.github.com/user")
                .header("User-Agent", "vmx")
                .bearer_auth(&gh_token)
                .send()
                .await;

            if response.is_err() {
                tracing::error!("Failed to fetch user info");
                return HttpResponse::InternalServerError().finish();
            }

            let profile = response.unwrap().json::<GithubProfile>().await;

            if profile.is_err() {
                tracing::error!("Failed to parse user info");
                return HttpResponse::InternalServerError().finish();
            }

            let profile = profile.unwrap();
            session.insert("gh_access_token", &gh_token).unwrap();

            let secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");

            let access_token = jsonwebtoken::encode(
                &jsonwebtoken::Header::default(),
                &Claims {
                    sub: format!("gh:{}", profile.login),
                    exp: chrono::Utc::now().timestamp() + 3600 * 24 * 7,
                    iat: chrono::Utc::now().timestamp(),
                },
                &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
            )
            .unwrap();
            let mut kv = kv.lock().await;
            let id = cuid2::create_id();
            kv.insert(id.clone(), access_token);

            let origin = format!(
                "{}?id={}",
                env::var("ORIGIN").unwrap_or(String::from("http://localhost:8887")),
                id
            );

            HttpResponse::Found()
                .append_header(("Location", origin))
                .finish()
        }
        None => HttpResponse::BadRequest().finish(),
    }
}

#[actix_web::get("/oauth/callback")]
async fn oauth_callback(
    oauth: web::Data<Arc<OauthClientType>>,
    query: web::Query<serde_json::Value>,
    kv: web::Data<Arc<Mutex<HashMap<String, String>>>>,
) -> impl Responder {
    println!("query:\n {:?}", query);
    let secret = env::var("JWT_SECRET");

    if secret.is_err() {
        tracing::error!("JWT_SECRET environment variable is not set");
        return HttpResponse::InternalServerError().finish();
    }
    let secret = secret.unwrap();

    let params = query.into_inner();

    if params["code"].as_str().is_none() {
        return HttpResponse::BadRequest().finish();
    }

    let params = CallbackParams {
        code: params["code"].as_str().unwrap_or_default().into(),
        state: params["state"].as_str().map(|v| v.into()),
        iss: params["iss"].as_str().map(|v| v.into()),
    };

    let session = oauth.callback(params).await;

    if session.is_err() {
        tracing::error!("Failed to callback");
        return HttpResponse::InternalServerError().finish();
    }

    let session = session.unwrap();
    let agent = Agent::new(session);
    let info = agent.info().await;
    if info.is_none() {
        tracing::error!("Failed to get agent info");
        return HttpResponse::InternalServerError().finish();
    }
    let info = info.unwrap();
    tracing::info!(did = ?info, "ATProto login successful for DID");

    let access_token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &Claims {
            sub: info.0.replace("at://", ""),
            exp: chrono::Utc::now().timestamp() + 3600 * 24 * 7,
            iat: chrono::Utc::now().timestamp(),
        },
        &jsonwebtoken::EncodingKey::from_secret(secret.as_bytes()),
    )
    .unwrap();

    let mut kv = kv.lock().await;
    let id = cuid2::create_id();
    kv.insert(id.clone(), access_token);

    let origin = format!(
        "{}?id={}",
        env::var("ORIGIN").unwrap_or(String::from("http://localhost:8887")),
        id
    );

    HttpResponse::Found()
        .append_header(("Location", origin))
        .finish()
}

pub async fn run_http_server() -> Result<(), anyhow::Error> {
    dotenv().ok();

    let token = read_token_file()?;
    env::set_var("VMX_TOKEN", token);

    let format = Format::default()
        .with_level(true)
        .with_target(true)
        .with_ansi(true)
        .compact();

    tracing_subscriber::fmt()
        .event_format(format)
        .with_max_level(tracing::Level::INFO)
        .init();

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

    let arc_pool = Arc::new(pool.clone());
    let origin = std::env::var("APP_ORIGIN").unwrap_or("http://127.0.0.1:8887".to_string());

    let store = SqliteSessionStore::new(pool.clone());
    let client_data = jacquard_oauth::session::ClientData {
        keyset: None,
        config: AtprotoClientMetadata::new_localhost(
            Some(vec![
                Url::parse(&format!("{origin}/oauth/callback")).unwrap()
            ]),
            Some(vec![
                Scope::Atproto,
                Scope::Transition(TransitionScope::Generic),
            ]),
        ),
    };
    let oauth = Arc::new(OAuthClient::new(store, client_data));

    let client_id = option_env!("GITHUB_CLIENT_ID").unwrap().to_string();
    let oauth_client = BasicClient::new(ClientId::new(client_id))
        .set_client_secret(ClientSecret::new(
            option_env!("GITHUB_CLIENT_SECRET").unwrap().to_string(),
        ))
        .set_auth_uri(AuthUrl::new("https://github.com/login/oauth/authorize".to_string()).unwrap())
        .set_token_uri(
            TokenUrl::new("https://github.com/login/oauth/access_token".to_string()).unwrap(),
        )
        .set_redirect_uri(
            RedirectUrl::new("http://localhost:8887/oauth/github/callback".to_string()).unwrap(),
        );
    let app_state = AppState { oauth_client };
    let kv = Arc::new(Mutex::new(HashMap::<String, String>::new()));

    tracing::info!("Starting VMX UI at {}", addr);
    tracing::info!("Proxying /api/* requests to {}", backend_url);

    HttpServer::new(move || {
        let secret_key = env::var("SECRET_KEY").expect("SECRET_KEY must be set");
        let secret_key = Key::from(secret_key.as_bytes());
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .supports_credentials()
            .max_age(3600);

        App::new()
            .wrap(middleware::Logger::default())
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), secret_key)
                    .cookie_name("vmx-session".to_string())
                    .cookie_secure(false)
                    .cookie_http_only(true)
                    .cookie_same_site(actix_web::cookie::SameSite::Lax)
                    .build(),
            )
            .wrap(cors)
            .app_data(web::Data::new(oauth.clone()))
            .app_data(web::Data::new(arc_pool.clone()))
            .app_data(web::Data::new(app_state.clone()))
            .app_data(web::Data::new(kv.clone()))
            .service(index)
            .service(sshkeys)
            .service(me)
            .service(get_access_token)
            .service(api)
            .service(login)
            .service(login_with_github)
            .service(oauth_callback)
            .service(oauth_github_callback)
            .service(spa_routes)
            .service(dist)
    })
    .bind(addr)?
    .run()
    .await?;

    Ok(())
}
