use sqlx::Pool;

use crate::entity::auth_session::AuthSession;

pub async fn get_by_did(
    pool: &Pool<sqlx::Sqlite>,
    did: &str,
) -> Result<Option<AuthSession>, sqlx::Error> {
    let session = sqlx::query_as(
        r#"
            SELECT * FROM auth_sessions WHERE did = ?
        "#,
    )
    .bind(did)
    .fetch_optional(pool)
    .await?;

    Ok(session)
}

pub async fn save_or_update(
    pool: &Pool<sqlx::Sqlite>,
    session: &AuthSession,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
            INSERT INTO auth_sessions (key, session)
            VALUES (?, ?)
            ON CONFLICT (key) DO UPDATE SET session = ?, updated_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(&session.key)
    .bind(&session.session)
    .bind(&session.session) // Note: need to bind again for the UPDATE clause
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_by_did(pool: &Pool<sqlx::Sqlite>, did: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
            DELETE FROM auth_sessions WHERE did = ?
        "#,
    )
    .bind(did)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_all(pool: &Pool<sqlx::Sqlite>) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
            DELETE FROM auth_sessions
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
