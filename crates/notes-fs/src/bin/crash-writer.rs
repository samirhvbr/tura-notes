//! Writes a note in a tight loop until it is killed. Driven by
//! `tools/crash-save-loop.sh`.
//!
//! Every payload is **self-describing** — `LEN=<n>` then `n` bytes then `END` —
//! so the checker can tell a complete note from a truncated one without knowing
//! which iteration the kill landed on. That is the whole design: after a
//! `SIGKILL` the file must be some *complete* payload, old or new, and never a
//! prefix of one.
//!
//!     crash-writer <workspace-dir> [note-name]

use notes_fs::{FileSystem, LocalFs};
use notes_model::RelPath;

fn main() {
    let mut args = std::env::args().skip(1);
    let dir = args.next().expect("usage: crash-writer <dir> [note]");
    #[cfg(windows)]
    if dir == "--windows-round" {
        if let Err(error) = windows_round::run(args) {
            eprintln!("{error}");
            std::process::exit(1);
        }
        return;
    }
    let name = args.next().unwrap_or_else(|| "crash.md".to_string());

    let fs = LocalFs::open(&dir).expect("open workspace");
    let path = RelPath::parse(&name).expect("note name");

    let mut n: usize = 1;
    loop {
        // Vary the length across page and buffer boundaries, where a partial
        // write is most likely to be observable.
        let len = [1usize, 100, 4095, 4096, 4097, 65_536, 200_000][n % 7];
        let body = "x".repeat(len);
        let payload = format!("LEN={len}\n{body}\nEND\n");
        if fs.write_atomic(&path, payload.as_bytes(), None).is_err() {
            std::process::exit(2);
        }
        n = n.wrapping_add(1);
    }
}

#[cfg(windows)]
mod windows_round {
    use std::io;
    use std::os::windows::io::AsRawHandle;
    use std::process::{Child, Command, ExitStatus, Stdio};
    use std::thread;
    use std::time::Duration;
    use windows_sys::Win32::Foundation::{WAIT_OBJECT_0, WAIT_TIMEOUT};
    use windows_sys::Win32::System::Threading::{TerminateProcess, WaitForSingleObject};

    const KILLED: u32 = 137;
    const WAIT_MS: u32 = 5000;

    pub(super) fn run(
        mut args: impl Iterator<Item = String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let usage = "usage: crash-writer --windows-round <delay-ms> <writer> <dir>";
        let delay = args.next().ok_or(usage)?.parse()?;
        let binary = args.next().ok_or(usage)?;
        let workspace = args.next().ok_or(usage)?;
        if args.next().is_some() || !(1..=999).contains(&delay) {
            return Err(usage.into());
        }
        let mut writer = Command::new(binary)
            .arg(workspace)
            .arg("crash.md")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        thread::sleep(Duration::from_millis(delay));
        terminate(&mut writer)?;
        Ok(())
    }

    fn early_exit(pid: u32, status: ExitStatus) -> io::Error {
        io::Error::other(format!(
            "writer (winpid {pid}) exited before the kill ({status})"
        ))
    }

    fn terminate(writer: &mut Child) -> io::Result<()> {
        let pid = writer.id();
        if let Some(status) = writer.try_wait()? {
            return Err(early_exit(pid, status));
        }
        let handle = writer.as_raw_handle();
        // SAFETY: Child owns this process handle throughout the termination
        // and wait. No lookup by PID or MSYS child state is involved.
        if unsafe { TerminateProcess(handle, KILLED) } == 0 {
            let error = io::Error::last_os_error();
            // The process may have exited between try_wait and TerminateProcess.
            if let Some(status) = writer.try_wait()? {
                return Err(early_exit(pid, status));
            }
            return Err(io::Error::other(format!(
                "could not terminate writer (winpid {pid}): {error}"
            )));
        }
        // SAFETY: The same owned process handle is valid during this bounded wait.
        match unsafe { WaitForSingleObject(handle, WAIT_MS) } {
            WAIT_OBJECT_0 => {}
            WAIT_TIMEOUT => {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    format!("writer (winpid {pid}) was still running 5 s after the kill"),
                ));
            }
            _ => {
                let error = io::Error::last_os_error();
                return Err(io::Error::other(format!(
                    "could not wait for writer (winpid {pid}): {error}"
                )));
            }
        }
        // A signaled process handle remains signaled, so this collects status
        // without extending the timeout.
        let status = writer.wait()?;
        if status.code() != Some(KILLED as i32) {
            return Err(io::Error::other(format!(
                "writer (winpid {pid}) ended with {status} after requesting exit code {KILLED}"
            )));
        }
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn rejects_natural_exits_including_the_supervisors_exit_code() {
            for code in [0, 2, 101, KILLED] {
                let mut writer = Command::new("cmd.exe")
                    .args(["/d", "/c", "exit", "/b", &code.to_string()])
                    .spawn()
                    .unwrap();
                let status = writer.wait().unwrap();
                assert_eq!(status.code(), Some(code as i32));
                let message = terminate(&mut writer).unwrap_err().to_string();
                assert!(message.contains("exited before the kill"), "{message}");
                assert!(message.contains(&status.to_string()), "{message}");
            }
        }
    }
}
