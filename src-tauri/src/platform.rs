//! Platform glue: process spawning without a console window on Windows,
//! sidecar binary names, and privileged (administrator) helpers on macOS.

use std::{ffi::OsStr, process::Command};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// `std::process::Command` that does not flash a console window on Windows.
pub fn command<S: AsRef<OsStr>>(program: S) -> Command {
    #[allow(unused_mut)]
    let mut command = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

/// `tokio::process::Command` that does not flash a console window on Windows.
pub fn tokio_command<S: AsRef<OsStr>>(program: S) -> tokio::process::Command {
    #[allow(unused_mut)]
    let mut command = tokio::process::Command::new(program);
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

/// Sidecar file name for this platform: `xray` -> `xray.exe` on Windows.
pub fn exe(name: &str) -> String {
    format!("{name}{}", std::env::consts::EXE_SUFFIX)
}

/// AmneziaWG runtime: the Windows client (tunnel service) or amneziawg-go on macOS.
pub fn amnezia_binary() -> String {
    if cfg!(target_os = "macos") {
        "amneziawg-go".to_string()
    } else {
        exe("amneziawg")
    }
}

pub fn platform_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        std::env::consts::OS
    }
}

#[cfg(target_os = "macos")]
pub mod macos {
    use std::{
        path::Path,
        process::{Child, Stdio},
    };

    use crate::error::{AppError, AppResult};

    /// Single-quoted for /bin/sh.
    pub fn shell_quote(value: &str) -> String {
        format!("'{}'", value.replace('\'', "'\\''"))
    }

    fn applescript_string(value: &str) -> String {
        format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
    }

    fn admin_osascript(script_path: &Path) -> std::process::Command {
        let shell = format!("/bin/sh {}", shell_quote(&script_path.to_string_lossy()));
        let mut command = super::command("/usr/bin/osascript");
        command.arg("-e").arg(format!(
            "do shell script {} with administrator privileges",
            applescript_string(&shell)
        ));
        command
    }

    /// Runs a shell script as root (the system asks for the administrator
    /// password) and waits for it.
    pub fn run_admin_script(script_path: &Path) -> AppResult<String> {
        let output = admin_osascript(script_path)
            .stdin(Stdio::null())
            .output()
            .map_err(|error| AppError::process("Failed to run osascript", Some(error.to_string())))?;
        if output.status.success() {
            return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.contains("-128") {
            return Err(AppError::state("Administrator authorization was cancelled."));
        }
        Err(AppError::process("Privileged command failed", Some(stderr)))
    }

    /// Starts a long-running root script. The returned child is the osascript
    /// process; it exits when the root script exits.
    pub fn spawn_admin_script(script_path: &Path) -> AppResult<Child> {
        admin_osascript(script_path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| AppError::process("Failed to run osascript", Some(error.to_string())))
    }

    pub fn write_script(path: &Path, body: &str) -> AppResult<()> {
        std::fs::write(path, format!("#!/bin/sh\n{body}\n"))
            .map_err(|error| AppError::process("Failed to write helper script", Some(error.to_string())))
    }

    pub fn is_root() -> bool {
        super::command("/usr/bin/id")
            .arg("-u")
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).trim() == "0")
            .unwrap_or(false)
    }

    /// Default IPv4 route: (interface, gateway).
    pub fn default_route() -> AppResult<(String, Option<String>)> {
        let output = super::command("/sbin/route")
            .args(["-n", "get", "default"])
            .output()
            .map_err(|error| AppError::process("Failed to query the default route", Some(error.to_string())))?;
        let text = String::from_utf8_lossy(&output.stdout);
        let field = |name: &str| {
            text.lines()
                .filter_map(|line| line.trim().split_once(':'))
                .find(|(key, _)| key.trim() == name)
                .map(|(_, value)| value.trim().to_string())
        };
        let interface = field("interface")
            .ok_or_else(|| AppError::process("No active IPv4 default route found.", Some(text.to_string())))?;
        Ok((interface, field("gateway")))
    }

    /// Enabled network services (`networksetup -listallnetworkservices`).
    pub fn network_services() -> AppResult<Vec<String>> {
        let output = super::command("/usr/sbin/networksetup")
            .arg("-listallnetworkservices")
            .output()
            .map_err(|error| AppError::proxy("Failed to list network services", Some(error.to_string())))?;
        Ok(String::from_utf8_lossy(&output.stdout)
            .lines()
            .skip(1)
            .map(str::trim)
            .filter(|line| !line.is_empty() && !line.starts_with('*'))
            .map(ToOwned::to_owned)
            .collect())
    }
}
