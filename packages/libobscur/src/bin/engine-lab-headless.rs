//! Headless engine_invoke CLI — no WebView. Reads one JSON request from stdin, writes JSON result to stdout.
//!
//! Usage:
//!   engine-lab-headless --db <sqlite-path>
//!   echo '{"engine":"dm","method":"listConversations","scope":{"profileId":"p"}}' | engine-lab-headless --db ./data.sqlite

use libobscur::db::Database;
use libobscur::engine_invoke::{dispatch, EngineInvokeRequest, EngineInvokeResult};
use std::env;
use std::io::{self, Read};
use std::process;

fn usage() -> ! {
    eprintln!("Usage: engine-lab-headless --db <sqlite-path>");
    process::exit(2);
}

fn read_stdin_request() -> Result<EngineInvokeRequest, String> {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .map_err(|e| format!("failed to read stdin: {e}"))?;
    serde_json::from_str(input.trim())
        .map_err(|e| format!("invalid engine invoke request JSON: {e}"))
}

fn write_result(result: EngineInvokeResult) -> ! {
    match serde_json::to_string(&result) {
        Ok(json) => {
            println!("{json}");
            process::exit(if result.ok { 0 } else { 1 });
        }
        Err(e) => {
            eprintln!("failed to serialize result: {e}");
            process::exit(1);
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let db_path = match args.windows(2).find(|w| w[0] == "--db") {
        Some(pair) => pair[1].clone(),
        None => usage(),
    };

    let request = match read_stdin_request() {
        Ok(request) => request,
        Err(message) => write_result(libobscur::engine_invoke::EngineInvokeResult {
            ok: false,
            data: None,
            error_code: Some("invalid_request".to_string()),
            error_message: Some(message),
        }),
    };

    let db = match Database::new(Some(&db_path)) {
        Ok(db) => db,
        Err(e) => write_result(libobscur::engine_invoke::EngineInvokeResult {
            ok: false,
            data: None,
            error_code: Some("db_open_error".to_string()),
            error_message: Some(e.to_string()),
        }),
    };

    write_result(dispatch(&db, &request));
}
