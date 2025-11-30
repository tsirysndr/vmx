use dashmap::DashMap;
use jacquard::client::{SessionStore, SessionStoreError};
use jacquard::smol_str::{SmolStr, ToSmolStr};
use jacquard::types::did::Did;
use jacquard::IntoStatic;
use jacquard_oauth::authstore::ClientAuthStore;
use jacquard_oauth::session::{AuthRequestData, ClientSessionData};
use serde::{de::DeserializeOwned, Serialize};
use sqlx::Pool;
use std::fmt::Debug;
use std::hash::Hash;

use crate::repo;

pub struct SqliteSessionStore {
    pool: Pool<sqlx::Sqlite>,
    auth_reqs: DashMap<SmolStr, AuthRequestData<'static>>,
}

impl SqliteSessionStore {
    pub fn new(pool: Pool<sqlx::Sqlite>) -> Self {
        Self {
            pool,
            auth_reqs: DashMap::new(),
        }
    }
}

impl<K, V> SessionStore<K, V> for SqliteSessionStore
where
    K: Eq + Hash + Send + Sync + AsRef<str>,
    V: Debug + Clone + Send + Sync + 'static + Serialize + DeserializeOwned,
{
    async fn get(&self, key: &K) -> Option<V> {
        let did = key.as_ref();
        let auth_session = repo::auth_session::get_by_did(&self.pool, did).await;

        if auth_session.is_err() {
            return None;
        }

        let auth_session = auth_session.unwrap();
        if auth_session.is_none() {
            return None;
        }

        let auth_session = auth_session.unwrap();
        let deserialized_session = serde_json::from_str(&auth_session.session);

        if deserialized_session.is_err() {
            return None;
        }

        Some(deserialized_session.unwrap())
    }

    async fn set(&self, key: K, session: V) -> Result<(), SessionStoreError> {
        let did = key.as_ref().to_string();
        repo::auth_session::save_or_update(
            &self.pool,
            &did,
            &serde_json::to_string(&session).map_err(|e| SessionStoreError::Serde(e))?,
        )
        .await
        .map_err(|e| SessionStoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
        Ok(())
    }

    async fn del(&self, key: &K) -> Result<(), SessionStoreError> {
        let did = key.as_ref();
        repo::auth_session::delete_by_did(&self.pool, did)
            .await
            .map_err(|e| {
                SessionStoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e))
            })?;
        Ok(())
    }
}

impl ClientAuthStore for SqliteSessionStore {
    async fn get_session(
        &self,
        did: &Did<'_>,
        session_id: &str,
    ) -> Result<Option<ClientSessionData<'_>>, SessionStoreError> {
        let key = format!("{}_{}", did, session_id);
        repo::auth_session::get_by_did(&self.pool, &key)
            .await
            .map_err(|e| {
                SessionStoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e))
            })?;
        Ok(None)
    }

    async fn upsert_session(
        &self,
        session: ClientSessionData<'_>,
    ) -> Result<(), SessionStoreError> {
        let key = format!("{}_{}", session.account_did, session.session_id);

        Ok(())
    }

    async fn delete_session(
        &self,
        did: &Did<'_>,
        session_id: &str,
    ) -> Result<(), SessionStoreError> {
        let key = format!("{}_{}", did, session_id);
        repo::auth_session::delete_by_did(&self.pool, &key)
            .await
            .map_err(|e| {
                SessionStoreError::Io(std::io::Error::new(std::io::ErrorKind::Other, e))
            })?;
        Ok(())
    }

    async fn get_auth_req_info(
        &self,
        state: &str,
    ) -> Result<Option<AuthRequestData<'_>>, SessionStoreError> {
        Ok(self.auth_reqs.get(state).map(|v| v.clone()))
    }

    async fn save_auth_req_info(
        &self,
        auth_req_info: &AuthRequestData<'_>,
    ) -> Result<(), SessionStoreError> {
        self.auth_reqs.insert(
            auth_req_info.state.clone().to_smolstr(),
            auth_req_info.clone().into_static(),
        );
        Ok(())
    }

    async fn delete_auth_req_info(&self, state: &str) -> Result<(), SessionStoreError> {
        self.auth_reqs.remove(state);
        Ok(())
    }
}
