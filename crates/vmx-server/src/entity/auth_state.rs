use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(FromRow, Debug, Clone, Deserialize, Serialize)]
pub struct AuthState {
    pub key: String,
    pub state: String,
    pub created_at: DateTime<Utc>,
}
