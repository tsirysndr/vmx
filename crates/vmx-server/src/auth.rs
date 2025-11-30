use std::{env, fs};

use anyhow::Error;
use jsonwebtoken::Validation;

use crate::types::Claims;

pub fn read_token_file() -> Result<String, Error> {
    let config_dir = format!("{}/.vmx", dirs::home_dir().unwrap().to_str().unwrap());
    let token = fs::read(format!("{}/token", config_dir))?;
    Ok(String::from_utf8(token)?)
}

pub fn validate_token(token: &str) -> Result<(), Error> {
    let secret = env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let key = &jsonwebtoken::DecodingKey::from_secret(secret.as_bytes());
    jsonwebtoken::decode::<Claims>(&token, key, &Validation::default())?;
    Ok(())
}
