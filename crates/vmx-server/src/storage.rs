use atrium_api::types::string::Did;
use atrium_common::store::Store;
use atrium_oauth::store::session::SessionStore;
use atrium_oauth::store::state::StateStore;
use serde::{de::DeserializeOwned, Serialize};
use sqlx::Pool;
use std::fmt::Debug;
use std::hash::Hash;
use thiserror::Error;

use crate::entity::auth_session::AuthSession;
use crate::entity::auth_state::AuthState;
use crate::repo;

#[derive(Error, Debug)]
pub enum SqliteStoreError {
    #[error("Invalid session")]
    InvalidSession,
    #[error("No session found")]
    NoSessionFound,
    #[error("Database error: {0}")]
    DatabaseError(sqlx::Error),
}

impl SessionStore for SqliteSessionStore {}

pub struct SqliteSessionStore {
    pool: Pool<sqlx::Sqlite>,
}

impl SqliteSessionStore {
    pub fn new(pool: Pool<sqlx::Sqlite>) -> Self {
        Self { pool }
    }
}

impl<K, V> Store<K, V> for SqliteSessionStore
where
    K: Debug + Eq + Hash + Send + Sync + 'static + From<Did> + AsRef<str>,
    V: Debug + Clone + Send + Sync + 'static + Serialize + DeserializeOwned,
{
    type Error = SqliteStoreError;
    async fn get(&self, key: &K) -> Result<Option<V>, Self::Error> {
        let did = key.as_ref();
        let auth_session = repo::auth_session::get_by_did(&self.pool, did)
            .await
            .map_err(|e| SqliteStoreError::DatabaseError(e))?;
        match auth_session {
            Some(auth_session) => {
                let deserialized_session: V = serde_json::from_str(&auth_session.session)
                    .map_err(|_| SqliteStoreError::InvalidSession)?;
                Ok(Some(deserialized_session))
            }
            None => Err(SqliteStoreError::NoSessionFound),
        }
    }

    async fn set(&self, key: K, value: V) -> Result<(), Self::Error> {
        let did = key.as_ref().to_string();
        repo::auth_session::save_or_update(
            &self.pool,
            &AuthSession {
                key: did,
                session: serde_json::to_string(&value)
                    .map_err(|_| SqliteStoreError::InvalidSession)?,
            },
        )
        .await
        .map_err(|e| SqliteStoreError::DatabaseError(e))?;
        Ok(())
    }

    async fn del(&self, key: &K) -> Result<(), Self::Error> {
        let did = key.as_ref();
        repo::auth_session::delete_by_did(&self.pool, did)
            .await
            .map_err(|e| SqliteStoreError::DatabaseError(e))?;
        Ok(())
    }

    async fn clear(&self) -> Result<(), Self::Error> {
        repo::auth_session::delete_all(&self.pool)
            .await
            .map_err(|e| SqliteStoreError::DatabaseError(e))?;
        Ok(())
    }
}

impl StateStore for SqliteStateStore {}

pub struct SqliteStateStore {
    pool: Pool<sqlx::Sqlite>,
}

impl SqliteStateStore {
    pub fn new(pool: Pool<sqlx::Sqlite>) -> Self {
        Self { pool }
    }
}

impl<K, V> Store<K, V> for SqliteStateStore
where
    K: Debug + Eq + Hash + Send + Sync + 'static + From<Did> + AsRef<str>,
    V: Debug + Clone + Send + Sync + 'static + Serialize + DeserializeOwned,
{
    type Error = SqliteStoreError;
    async fn get(&self, key: &K) -> Result<Option<V>, Self::Error> {
        let did = key.as_ref();
        let auth_state = repo::auth_state::get_by_key(&self.pool, did)
            .await
            .map_err(|e| SqliteStoreError::DatabaseError(e))?;
        match auth_state {
            Some(auth_state) => {
                let deserialized_state: V = serde_json::from_str(&auth_state.state)
                    .map_err(|_| SqliteStoreError::InvalidSession)?;
                Ok(Some(deserialized_state))
            }
            None => Err(SqliteStoreError::NoSessionFound),
        }
    }

    async fn set(&self, key: K, value: V) -> Result<(), Self::Error> {
        let did = key.as_ref().to_string();
        repo::auth_state::save_or_update(
            &self.pool,
            &AuthState {
                key: did,
                state: serde_json::to_string(&value)
                    .map_err(|_| SqliteStoreError::InvalidSession)?,
            },
        )
        .await
        .map_err(|e| SqliteStoreError::DatabaseError(e))?;
        Ok(())
    }

    async fn del(&self, key: &K) -> Result<(), Self::Error> {
        let did = key.as_ref();
        repo::auth_state::delete_by_key(&self.pool, did)
            .await
            .map_err(|e| SqliteStoreError::DatabaseError(e))?;
        Ok(())
    }

    async fn clear(&self) -> Result<(), Self::Error> {
        repo::auth_state::delete_all(&self.pool)
            .await
            .map_err(|e| SqliteStoreError::DatabaseError(e))?;
        Ok(())
    }
}
