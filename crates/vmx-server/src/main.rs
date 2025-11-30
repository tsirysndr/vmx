use vmx_server::run_http_server;

pub mod auth;
pub mod db;
pub mod entity;
pub mod repo;
pub mod storage;
pub mod types;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    run_http_server().await?;
    Ok(())
}
