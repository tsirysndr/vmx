use crate::entity::auth_state::AuthState;
use sqlx::Pool;

pub async fn get_by_key(
    pool: &Pool<sqlx::Sqlite>,
    key: &str,
) -> Result<Option<AuthState>, sqlx::Error> {
    let session = sqlx::query_as(
        r#"
            SELECT * FROM auth_states WHERE key = ?
        "#,
    )
    .bind(key)
    .fetch_optional(pool)
    .await?;

    Ok(session)
}

pub async fn save_or_update(
    pool: &Pool<sqlx::Sqlite>,
    key: &str,
    state: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
            INSERT INTO auth_states (key, state)
            VALUES (?, ?)
            ON CONFLICT (key) DO UPDATE SET state = EXCLUDED.state
        "#,
    )
    .bind(&key)
    .bind(&state)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_by_key(pool: &Pool<sqlx::Sqlite>, key: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
            DELETE FROM auth_states WHERE key = ?
        "#,
    )
    .bind(key)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_all(pool: &Pool<sqlx::Sqlite>) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
            DELETE FROM auth_states
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
