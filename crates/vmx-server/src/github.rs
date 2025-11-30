use anyhow::Error;

use crate::types::GithubProfile;

pub struct Github {
    token: String,
}

impl Github {
    pub fn new(token: &str) -> Self {
        Github {
            token: token.to_string(),
        }
    }

    pub async fn get_user(&self) -> Result<GithubProfile, Error> {
        let client = reqwest::Client::new();
        let response = client
            .get("https://api.github.com/user")
            .header("User-Agent", "vmx")
            .bearer_auth(&self.token)
            .send()
            .await?;

        let profile = response.json::<GithubProfile>().await?;
        Ok(profile)
    }
}
