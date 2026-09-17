//! Bounded newline-delimited JSON-RPC over stdio. No socket or app dependency.
//!
//! Everything that is MCP rather than stdio lives in the library beside this
//! file, so the server's `POST /v1/mcp` answers from the same catalogue and the
//! same envelope (`docs/MCP-0.7.md`). What is left here is the transport: read a
//! line, hand it over, write the reply.
use notes_core::agent::AgentConfig;
use notes_mcp::{handle, Session};
use serde_json::Value;
use std::io::{BufRead, Read, Write};

const MAX_MESSAGE: u64 = 32 * 1024 * 1024;

fn main() {
    if let Err(message) = run() {
        eprintln!("notes-mcp: {message}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if args.len() != 2 || args[0] != "--config" {
        return Err("usage: notes-mcp --config /absolute/path/agent.json".into());
    }
    let mut config_bytes = vec![];
    std::fs::File::open(&args[1])?
        .take(65537)
        .read_to_end(&mut config_bytes)?;
    if config_bytes.len() > 65536 {
        return Err("configuration exceeds 64 KiB".into());
    }
    let mut config: AgentConfig = serde_json::from_slice(&config_bytes)?;
    if !config.workspace.is_absolute() {
        return Err("workspace must be absolute".into());
    }
    config.workspace = std::fs::canonicalize(&config.workspace)?;
    // Validate operator configuration once, without exposing failures on stdout.
    drop(notes_core::agent::AgentService::new(config.clone())?);

    let mut input = std::io::stdin().lock();
    let mut output = std::io::stdout().lock();
    // Stdio is the session: one process, one client, and state that outlives a
    // message. The handshake gate is real here, unlike over HTTP.
    let mut session = Session::default();

    loop {
        let mut line = vec![];
        if (&mut input)
            .take(MAX_MESSAGE + 1)
            .read_until(b'\n', &mut line)?
            == 0
        {
            break;
        }
        if line.len() as u64 > MAX_MESSAGE {
            return Err("message exceeds 32 MiB".into());
        }
        let request: Value = match serde_json::from_slice(&line) {
            Ok(v) => v,
            Err(_) => {
                writeln!(
                    output,
                    "{}",
                    notes_mcp::error(Value::Null, -32700, "Invalid JSON")
                )?;
                output.flush()?;
                continue;
            }
        };
        if let Some(response) = handle(&config, &request, &mut session, None) {
            writeln!(output, "{response}")?;
            output.flush()?;
        }
    }
    Ok(())
}
