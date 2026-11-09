//! macOS system proxy via `networksetup`, applied to every enabled network
//! service. Same API as `proxy_manager_windows`, so `xray_manager` is shared.
//! WinHTTP has no macOS counterpart: those functions are no-ops.

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::{
    error::{AppError, AppResult},
    models::{PreviousSystemProxy, Settings, SplitTunnelMode},
    platform::{self, macos},
    proxy_rules::{build_proxy_override, pac_url_from_path, write_proxy_pac},
};

pub type ProxyState = PreviousSystemProxy;

const NETWORKSETUP: &str = "/usr/sbin/networksetup";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ProxyEndpoint {
    enabled: bool,
    server: String,
    port: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ServiceProxy {
    service: String,
    web: ProxyEndpoint,
    secure: ProxyEndpoint,
    auto_enabled: bool,
    auto_url: Option<String>,
    bypass: Vec<String>,
}

fn networksetup(args: &[String]) -> std::io::Result<std::process::Output> {
    platform::command(NETWORKSETUP).args(args).output()
}

fn read(args: &[&str]) -> String {
    let args: Vec<String> = args.iter().map(|value| value.to_string()).collect();
    networksetup(&args)
        .map(|output| String::from_utf8_lossy(&output.stdout).to_string())
        .unwrap_or_default()
}

fn field(text: &str, name: &str) -> Option<String> {
    text.lines()
        .filter_map(|line| line.split_once(':'))
        .find(|(key, _)| key.trim().eq_ignore_ascii_case(name))
        .map(|(_, value)| value.trim().to_string())
}

fn read_endpoint(flag: &str, service: &str) -> ProxyEndpoint {
    let text = read(&[flag, service]);
    ProxyEndpoint {
        enabled: field(&text, "Enabled").is_some_and(|value| value.eq_ignore_ascii_case("yes")),
        server: field(&text, "Server").unwrap_or_default(),
        port: field(&text, "Port").unwrap_or_default(),
    }
}

fn read_service(service: &str) -> ServiceProxy {
    let auto = read(&["-getautoproxyurl", service]);
    let bypass = read(&["-getproxybypassdomains", service]);
    ServiceProxy {
        service: service.to_string(),
        web: read_endpoint("-getwebproxy", service),
        secure: read_endpoint("-getsecurewebproxy", service),
        auto_enabled: field(&auto, "Enabled").is_some_and(|value| value.eq_ignore_ascii_case("yes")),
        auto_url: field(&auto, "URL").filter(|url| url != "(null)" && !url.is_empty()),
        bypass: if bypass.contains("aren't any") {
            Vec::new()
        } else {
            bypass.lines().map(str::trim).filter(|line| !line.is_empty()).map(ToOwned::to_owned).collect()
        },
    }
}

/// Runs networksetup commands; if the user is not allowed to change network
/// settings, runs the whole batch once as administrator.
fn apply(commands: Vec<Vec<String>>) -> AppResult<()> {
    let mut needs_admin = false;
    for args in &commands {
        let output = networksetup(args)
            .map_err(|error| AppError::proxy("Failed to run networksetup", Some(error.to_string())))?;
        let text = format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        if !output.status.success() || text.contains("requires admin") || text.contains("Error") {
            needs_admin = true;
            break;
        }
    }
    if !needs_admin {
        return Ok(());
    }

    let script = commands
        .iter()
        .map(|args| {
            std::iter::once(NETWORKSETUP.to_string())
                .chain(args.iter().map(|arg| macos::shell_quote(arg)))
                .collect::<Vec<_>>()
                .join(" ")
        })
        .collect::<Vec<_>>()
        .join("\n");
    let path = std::env::temp_dir().join(format!("veilbox-proxy-{}.sh", uuid::Uuid::new_v4()));
    macos::write_script(&path, &script)?;
    let result = macos::run_admin_script(&path);
    let _ = std::fs::remove_file(&path);
    result.map(|_| ())
}

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

/// `<local>`-style Windows override list -> networksetup bypass domains.
fn bypass_domains(settings: &Settings) -> AppResult<Vec<String>> {
    let mut domains = vec![
        "localhost".to_string(),
        "127.0.0.1".to_string(),
        "*.local".to_string(),
        "169.254/16".to_string(),
    ];
    for entry in build_proxy_override(settings)?.split(';') {
        let entry = entry.trim();
        if entry.is_empty() || entry == "<local>" {
            continue;
        }
        domains.push(entry.to_string());
    }
    domains.dedup();
    Ok(domains)
}

pub fn set_proxy(port: u16, settings_snapshot: &Settings, pac_path: &Path) -> AppResult<()> {
    let services = macos::network_services()?;
    let mut commands = Vec::new();
    if matches!(settings_snapshot.split_tunnel_mode, SplitTunnelMode::ProxyListed) {
        write_proxy_pac(port, settings_snapshot, pac_path)?;
        let url = pac_url_from_path(pac_path);
        for service in &services {
            commands.push(args(&["-setwebproxystate", service, "off"]));
            commands.push(args(&["-setsecurewebproxystate", service, "off"]));
            commands.push(args(&["-setautoproxyurl", service, &url]));
            commands.push(args(&["-setautoproxystate", service, "on"]));
        }
    } else {
        let _ = std::fs::remove_file(pac_path);
        let port = port.to_string();
        let bypass = bypass_domains(settings_snapshot)?;
        for service in &services {
            commands.push(args(&["-setautoproxystate", service, "off"]));
            commands.push(args(&["-setwebproxy", service, "127.0.0.1", &port]));
            commands.push(args(&["-setsecurewebproxy", service, "127.0.0.1", &port]));
            let mut bypass_args = args(&["-setproxybypassdomains", service]);
            bypass_args.extend(bypass.iter().cloned());
            commands.push(bypass_args);
        }
    }
    apply(commands)
}

pub fn clear_proxy(pac_path: Option<&Path>) -> AppResult<()> {
    let mut commands = Vec::new();
    for service in macos::network_services()? {
        commands.push(args(&["-setwebproxystate", &service, "off"]));
        commands.push(args(&["-setsecurewebproxystate", &service, "off"]));
        commands.push(args(&["-setautoproxystate", &service, "off"]));
    }
    if let Some(path) = pac_path {
        let _ = std::fs::remove_file(path);
    }
    apply(commands)
}

fn owns(state: &ProxyState, port: Option<u16>, pac_path: &Path) -> bool {
    let owns_server = port
        .map(|p| state.enabled && state.server.as_deref() == Some(format!("127.0.0.1:{p}").as_str()))
        .unwrap_or(false);
    let owns_pac = state.auto_config_url.as_deref() == Some(pac_url_from_path(pac_path).as_str());
    owns_server || owns_pac
}

pub fn clear_owned_proxy(port: Option<u16>, pac_path: &Path) -> AppResult<bool> {
    let state = get_proxy_state()?;
    if owns(&state, port, pac_path) {
        clear_proxy(Some(pac_path))?;
        return Ok(true);
    }
    Ok(false)
}

pub fn restore_owned_proxy(port: Option<u16>, pac_path: &Path, previous: Option<&ProxyState>) -> AppResult<bool> {
    let Some(previous) = previous else { return clear_owned_proxy(port, pac_path); };
    let state = get_proxy_state()?;
    if !owns(&state, port, pac_path) {
        return Ok(false);
    }
    let saved: Vec<ServiceProxy> = previous
        .platform_state
        .as_deref()
        .and_then(|json| serde_json::from_str(json).ok())
        .unwrap_or_default();
    if saved.is_empty() {
        clear_proxy(Some(pac_path))?;
        return Ok(true);
    }

    let mut commands = Vec::new();
    for entry in &saved {
        let service = entry.service.as_str();
        for (flag_set, flag_state, endpoint) in [
            ("-setwebproxy", "-setwebproxystate", &entry.web),
            ("-setsecurewebproxy", "-setsecurewebproxystate", &entry.secure),
        ] {
            if endpoint.enabled && !endpoint.server.is_empty() {
                commands.push(args(&[flag_set, service, &endpoint.server, &endpoint.port]));
            } else {
                commands.push(args(&[flag_state, service, "off"]));
            }
        }
        match (&entry.auto_url, entry.auto_enabled) {
            (Some(url), true) => {
                commands.push(args(&["-setautoproxyurl", service, url]));
                commands.push(args(&["-setautoproxystate", service, "on"]));
            }
            _ => commands.push(args(&["-setautoproxystate", service, "off"])),
        }
        let mut bypass_args = args(&["-setproxybypassdomains", service]);
        if entry.bypass.is_empty() {
            bypass_args.push("Empty".to_string());
        } else {
            bypass_args.extend(entry.bypass.iter().cloned());
        }
        commands.push(bypass_args);
    }
    let _ = std::fs::remove_file(pac_path);
    apply(commands)?;
    Ok(true)
}

pub fn capture_winhttp_dump() -> AppResult<String> {
    Err(AppError::proxy("WinHTTP is not available on macOS", None))
}

pub fn apply_winhttp_proxy(_port: u16, _settings_snapshot: &Settings, _pac_path: &Path) -> AppResult<()> {
    Ok(())
}

pub fn restore_owned_winhttp(_previous: Option<&str>, _port: Option<u16>, _pac_path: &Path) -> AppResult<bool> {
    Ok(true)
}

pub fn verify_proxy(port: u16) -> AppResult<bool> {
    let state = get_proxy_state()?;
    if state.enabled {
        return Ok(state.server.unwrap_or_default().contains(&format!("127.0.0.1:{port}")));
    }
    Ok(state.auto_config_url.unwrap_or_default().contains("system-proxy.pac"))
}

pub fn best_effort_cleanup(
    known_proxy_string: Option<String>,
    _previous_winhttp_dump: Option<String>,
    pac_path: &Path,
    previous_system_proxy: Option<&ProxyState>,
) -> AppResult<bool> {
    let state = get_proxy_state()?;
    if !state.enabled && state.auto_config_url.is_none() {
        return Ok(false);
    }
    let server = state.server.clone().unwrap_or_default();
    let looks_like_ours = known_proxy_string.as_deref().map(|known| state.enabled && server == known).unwrap_or(false)
        || state.auto_config_url.as_deref() == Some(pac_url_from_path(pac_path).as_str());
    if !looks_like_ours {
        return Ok(false);
    }
    let port = known_proxy_string
        .as_deref()
        .and_then(|value| value.rsplit(':').next())
        .and_then(|value| value.parse().ok());
    restore_owned_proxy(port, pac_path, previous_system_proxy)?;
    Ok(true)
}

pub fn get_proxy_state() -> AppResult<ProxyState> {
    let services: Vec<ServiceProxy> = macos::network_services()?.iter().map(|service| read_service(service)).collect();
    let web = services.iter().find(|entry| entry.web.enabled);
    let auto = services.iter().find(|entry| entry.auto_enabled && entry.auto_url.is_some());
    Ok(ProxyState {
        enabled: web.is_some(),
        server: web.map(|entry| format!("{}:{}", entry.web.server, entry.web.port)),
        override_list: web.map(|entry| entry.bypass.join(";")),
        auto_config_url: auto.and_then(|entry| entry.auto_url.clone()),
        platform_state: serde_json::to_string(&services).ok(),
    })
}
