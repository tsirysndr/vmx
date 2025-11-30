use std::{env, fs};

use anyhow::Error;
use awc::http::header::HeaderMap;
use jsonwebtoken::Validation;

use crate::types::Claims;

pub fn read_token_file() -> Result<String, Error> {
    let config_dir = format!("{}/.vmx", dirs::home_dir().unwrap().to_str().unwrap());
    let token = fs::read(format!("{}/token", config_dir))?;
    Ok(String::from_utf8(token)?)
}

pub fn validate_token(token: &str) -> Result<Claims, Error> {
    let secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let key = &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes());
    let data = jsonwebtoken::decode::<Claims>(&token, key, &Validation::default())?;
    Ok(data.claims)
}

pub fn decode_authorization_header(headers: &HeaderMap) -> Result<Option<String>, Error> {
    let auth_header = headers.get("Authorization");
    if auth_header.is_none() {
        return Err(Error::msg("Missing Authorization header"));
    }

    let auth_header = auth_header.unwrap();
    let auth_header = auth_header.to_str()?;
    let token = auth_header
        .split_whitespace()
        .nth(1)
        .ok_or(Error::msg("Invalid Authorization header"))?;

    if token == env::var("VMX_TOKEN")? {
        return Ok(Some("admin".to_string()));
    }

    let claims = validate_token(token)?;
    Ok(Some(claims.sub))
}
