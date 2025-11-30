use sqlx::Pool;

pub async fn create_tables_in_database(pool: &Pool<sqlx::Sqlite>) -> Result<(), sqlx::Error> {
    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS auth_sessions (
            key TEXT PRIMARY KEY,
            session TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );"#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS auth_states (
            key TEXT PRIMARY KEY,
            state TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );"#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
