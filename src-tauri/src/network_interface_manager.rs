use std::process::Stdio;

use serde::Deserialize;

use crate::{
    error::{AppError, AppResult},
    models::NetworkInterfaceInfo,
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn is_elevated() -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("net")
            .arg("session")
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .output();
        output.map(|s| s.status.success()).unwrap_or(false)
    }
    #[cfg(target_os = "macos")]
    {
        crate::platform::macos::is_root()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        false
    }
}

#[derive(Debug, Deserialize)]
struct RawNetworkInterface {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "Status")]
    status: Option<String>,
    #[serde(rename = "InterfaceDescription")]
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum NetworkInterfacePayload {
    One(RawNetworkInterface),
    Many(Vec<RawNetworkInterface>),
}

pub fn list_network_interfaces() -> AppResult<Vec<NetworkInterfaceInfo>> {
    #[cfg(target_os = "macos")]
    {
        // Hardware ports (Wi-Fi, Ethernet, ...) with their BSD device names.
        let output = crate::platform::command("/usr/sbin/networksetup")
            .arg("-listallhardwareports")
            .output()
            .map_err(|error| AppError::process("Failed to list network interfaces.", Some(error.to_string())))?;
        let text = String::from_utf8_lossy(&output.stdout);
        let mut items = Vec::new();
        let mut port: Option<String> = None;
        for line in text.lines() {
            if let Some(value) = line.strip_prefix("Hardware Port:") {
                port = Some(value.trim().to_string());
            } else if let Some(device) = line.strip_prefix("Device:") {
                let device = device.trim().to_string();
                if !device.is_empty() {
                    items.push(NetworkInterfaceInfo {
                        name: device,
                        status: "Unknown".to_string(),
                        description: port.take(),
                    });
                }
            }
        }
        return Ok(items);
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        return Err(AppError::process(
            "Network interface discovery is only available on Windows and macOS.",
            None,
        ));
    }

    #[cfg(target_os = "windows")]
    {
        let script = concat!(
            "$ErrorActionPreference = 'Stop'; ",
            "Get-NetAdapter | ",
            "Select-Object Name, Status, InterfaceDescription | ",
            "ConvertTo-Json -Compress"
        );

        let mut command = std::process::Command::new("powershell.exe");
        command
            .creation_flags(CREATE_NO_WINDOW)
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let output = command.output().map_err(|error| {
            AppError::process(
                "Failed to query Windows network interfaces.",
                Some(error.to_string()),
            )
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(AppError::process(
                "Windows interface discovery failed.",
                if stderr.is_empty() { None } else { Some(stderr) },
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() || stdout == "null" {
            return Ok(Vec::new());
        }

        let payload: NetworkInterfacePayload = serde_json::from_str(&stdout).map_err(|error| {
            AppError::process(
                "Failed to parse Windows interface list.",
                Some(error.to_string()),
            )
        })?;

        let mut interfaces: Vec<NetworkInterfaceInfo> = match payload {
            NetworkInterfacePayload::One(interface) => vec![to_public(interface)],
            NetworkInterfacePayload::Many(items) => items.into_iter().map(to_public).collect(),
        };

        interfaces.sort_by(|left, right| {
            interface_rank(&left.status)
                .cmp(&interface_rank(&right.status))
                .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
        });

        Ok(interfaces)
    }
}

fn to_public(raw: RawNetworkInterface) -> NetworkInterfaceInfo {
    NetworkInterfaceInfo {
        name: raw.name,
        status: raw.status.unwrap_or_else(|| "Unknown".to_string()),
        description: raw.description.filter(|value| !value.trim().is_empty()),
    }
}

fn interface_rank(status: &str) -> u8 {
    if status.eq_ignore_ascii_case("up") {
        0
    } else if status.eq_ignore_ascii_case("dormant") {
        1
    } else if status.eq_ignore_ascii_case("disconnected") {
        2
    } else {
        3
    }
}
