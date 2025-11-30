use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(FromRow, Debug, Clone, Deserialize, Serialize)]
pub struct AuthSession {
    pub key: String,
    pub session: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
