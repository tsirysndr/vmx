use anyhow::Error;
use deno_bindgen::deno_bindgen;

#[deno_bindgen(non_blocking)]
pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[deno_bindgen]
pub fn start_http_server() {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    match rt.block_on(async {
        vmx_server::run_http_server().await?;
        Ok::<(), Error>(())
    }) {
        Ok(_) => (),
        Err(e) => panic!("Error starting HTTP server: {}", e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
