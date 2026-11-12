//! AmneziaWG on macOS: amneziawg-go (userspace, utun) + awg (setconf).
//!
//! Bringing a tunnel up needs root. One administrator prompt starts a root
//! shell script that creates the interface, applies the config, addresses,
//! routes and DNS, then stays alive while a user-owned control file exists
//! and the app is running. Disconnect deletes the control file: the script
//! tears everything down itself, so no second prompt is needed.

use std::{
    net::{IpAddr, ToSocketAddrs},
    path::{Path, PathBuf},
    process::Child,
    sync::Mutex,
    time::{Duration, Instant},
};

use chrono::Utc;
use tauri::{AppHandle, Emitter, Manager};

use crate::{
    error::{AppError, AppResult},
    models::{
        AmneziaConfig, ConnectionState, ConnectionStatusPayload, LogLevel, LogSource, Profile,
        TestConnectionResult,
    },
    platform::macos::{self, shell_quote},
    state::AppState,
};

const START_TIMEOUT: Duration = Duration::from_secs(120);
const STOP_TIMEOUT: Duration = Duration::from_secs(8);

/// Keys `awg setconf` does not accept: wg-quick handles them, here the script does.
const WG_QUICK_KEYS: [&str; 9] = [
    "address", "dns", "mtu", "table", "preup", "postup", "predown", "postdown", "saveconfig",
];

struct Tunnel {
    child: Child,
    run_file: PathBuf,
}

static TUNNEL: Mutex<Option<Tunnel>> = Mutex::new(None);

fn runtime_dir(state: &AppState) -> PathBuf {
    state
        .paths
        .amnezia_config_file
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(std::env::temp_dir)
}

fn awg_tool(state: &AppState) -> PathBuf {
    state.paths.amnezia_sidecar_path.with_file_name("awg")
}

/// Config for `awg setconf`: wg-quick keys removed, Endpoint pinned to the
/// resolved IP (the same IP the bypass route is added for).
fn setconf_text(raw: &str, endpoint: &str) -> String {
    let mut section = String::new();
    raw.lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with('[') {
                section = trimmed.to_ascii_lowercase();
                return Some(line.to_string());
            }
            let Some((key, _)) = trimmed.split_once('=') else {
                return Some(line.to_string());
            };
            let key = key.trim().to_ascii_lowercase();
            if section == "[interface]" && WG_QUICK_KEYS.contains(&key.as_str()) {
                return None;
            }
            if section == "[peer]" && key == "endpoint" {
                return Some(format!("Endpoint = {endpoint}"));
            }
            Some(line.to_string())
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn interface_mtu(raw: &str) -> u16 {
    raw.lines()
        .filter_map(|line| line.trim().split_once('='))
        .find(|(key, _)| key.trim().eq_ignore_ascii_case("mtu"))
        .and_then(|(_, value)| value.trim().parse().ok())
        .unwrap_or(1420)
}

fn resolve_endpoint(config: &AmneziaConfig) -> AppResult<IpAddr> {
    let host = config.endpoint_host.trim_matches(['[', ']']);
    (host, config.endpoint_port)
        .to_socket_addrs()
        .map_err(|error| AppError::process("Unable to resolve the AmneziaWG endpoint", Some(error.to_string())))?
        .map(|address| address.ip())
        .find(IpAddr::is_ipv4)
        .or_else(|| (host, config.endpoint_port).to_socket_addrs().ok()?.next().map(|address| address.ip()))
        .ok_or_else(|| AppError::process("The AmneziaWG endpoint has no address", Some(host.to_string())))
}

fn route_commands(allowed_ips: &[String]) -> Vec<String> {
    let mut commands = Vec::new();
    for cidr in allowed_ips.iter().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        let v6 = cidr.contains(':');
        let family = if v6 { "-inet6" } else { "-inet" };
        let targets: Vec<&str> = match cidr {
            "0.0.0.0/0" => vec!["0.0.0.0/1", "128.0.0.0/1"],
            "::/0" => vec!["::/1", "8000::/1"],
            other => vec![other],
        };
        for target in targets {
            commands.push(format!(
                "/sbin/route -q -n add {family} {} -interface \"$IF\" >> \"$LOG\" 2>&1",
                shell_quote(target)
            ));
        }
    }
    commands
}

fn address_commands(addresses: &[String]) -> Vec<String> {
    addresses
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|address| {
            let (ip, prefix) = address.split_once('/').unwrap_or((address, ""));
            if ip.contains(':') {
                let prefix = if prefix.is_empty() { "128" } else { prefix };
                format!(
                    "/sbin/ifconfig \"$IF\" inet6 {} prefixlen {} alias >> \"$LOG\" 2>&1",
                    shell_quote(ip),
                    shell_quote(prefix)
                )
            } else {
                let cidr = if prefix.is_empty() { format!("{ip}/32") } else { address.to_string() };
                format!(
                    "/sbin/ifconfig \"$IF\" inet {} {} alias >> \"$LOG\" 2>&1",
                    shell_quote(&cidr),
                    shell_quote(ip)
                )
            }
        })
        .collect()
}

fn build_script(state: &AppState, config: &AmneziaConfig, endpoint_ip: IpAddr, files: &Files) -> String {
    let dns = config
        .dns_servers
        .iter()
        .map(|value| value.trim())
        .filter(|value| value.parse::<IpAddr>().is_ok())
        .map(shell_quote)
        .collect::<Vec<_>>()
        .join(" ");
    let endpoint_route = if endpoint_ip.is_ipv4() {
        format!(
            "GW=$(/sbin/route -n get default 2>/dev/null | /usr/bin/awk '/gateway:/{{print $2}}')\n\
             [ -n \"$GW\" ] && /sbin/route -q -n add -inet {ep}/32 \"$GW\" >> \"$LOG\" 2>&1",
            ep = endpoint_ip
        )
    } else {
        String::new()
    };
    let endpoint_route_down = if endpoint_ip.is_ipv4() {
        format!("/sbin/route -q -n delete -inet {endpoint_ip}/32 >/dev/null 2>&1")
    } else {
        String::new()
    };
    let (dns_up, dns_down) = if dns.is_empty() {
        (String::new(), String::new())
    } else {
        (
            format!(
                ": > \"$DNSF\"\n\
                 /usr/sbin/networksetup -listallnetworkservices | /usr/bin/tail -n +2 | /usr/bin/grep -v '^\\*' | while IFS= read -r SVC; do\n\
                 \x20 CUR=$(/usr/sbin/networksetup -getdnsservers \"$SVC\" | /usr/bin/tr '\\n' ' ')\n\
                 \x20 case \"$CUR\" in *\"aren't any\"*) CUR=Empty;; esac\n\
                 \x20 printf '%s\\t%s\\n' \"$SVC\" \"$CUR\" >> \"$DNSF\"\n\
                 \x20 /usr/sbin/networksetup -setdnsservers \"$SVC\" {dns} >> \"$LOG\" 2>&1\n\
                 done"
            ),
            "if [ -f \"$DNSF\" ]; then\n\
             \x20 TAB=$(printf '\\t')\n\
             \x20 while IFS=\"$TAB\" read -r SVC CUR; do /usr/sbin/networksetup -setdnsservers \"$SVC\" $CUR >/dev/null 2>&1; done < \"$DNSF\"\n\
             \x20 rm -f \"$DNSF\"\n\
             fi"
                .to_string(),
        )
    };

    format!(
        r#"RUN={run}; READY={ready}; LOG={log}; NAMEF={namef}; DNSF={dnsf}; STATUS={status}; APP={app}
: > "$LOG"
rm -f "$READY" "$NAMEF"
WG_TUN_NAME_FILE="$NAMEF" {go} utun >> "$LOG" 2>&1 || exit 1
i=0; while [ ! -s "$NAMEF" ] && [ $i -lt 100 ]; do sleep 0.1; i=$((i+1)); done
IF=$(cat "$NAMEF" 2>/dev/null)
[ -n "$IF" ] || {{ echo "amneziawg-go did not create an interface" >> "$LOG"; exit 1; }}
down() {{
{dns_down}
{endpoint_route_down}
rm -f "/var/run/amneziawg/$IF.sock" "/var/run/wireguard/$IF.sock"
rm -f "$READY" "$RUN" "$NAMEF" "$STATUS" "$STATUS.tmp"
}}
{awg} setconf "$IF" {conf} >> "$LOG" 2>&1 || {{ down; exit 1; }}
{addresses}
/sbin/ifconfig "$IF" mtu {mtu} up >> "$LOG" 2>&1
{endpoint_route}
{routes}
{dns_up}
echo "$IF" > "$READY"; chmod 644 "$READY" "$LOG"
n=0
while [ -e "$RUN" ] && kill -0 "$APP" 2>/dev/null && /sbin/ifconfig "$IF" >/dev/null 2>&1; do
  if [ $((n % 2)) -eq 0 ]; then
    {awg} show "$IF" dump > "$STATUS.tmp" 2>/dev/null && chmod 644 "$STATUS.tmp" && mv -f "$STATUS.tmp" "$STATUS"
  fi
  n=$((n+1)); sleep 1
done
down
exit 0"#,
        run = shell_quote(&files.run.to_string_lossy()),
        ready = shell_quote(&files.ready.to_string_lossy()),
        log = shell_quote(&files.log.to_string_lossy()),
        namef = shell_quote(&files.name.to_string_lossy()),
        dnsf = shell_quote(&files.dns.to_string_lossy()),
        status = shell_quote(&files.status.to_string_lossy()),
        app = std::process::id(),
        go = shell_quote(&state.paths.amnezia_sidecar_path.to_string_lossy()),
        awg = shell_quote(&awg_tool(state).to_string_lossy()),
        conf = shell_quote(&files.setconf.to_string_lossy()),
        addresses = address_commands(&config.interface_addresses).join("\n"),
        mtu = interface_mtu(&config.raw_config),
        routes = route_commands(&config.allowed_ips).join("\n"),
    )
}

struct Files {
    run: PathBuf,
    ready: PathBuf,
    log: PathBuf,
    name: PathBuf,
    dns: PathBuf,
    /// `awg show <if> dump`, refreshed by the root script (see `awg_status`).
    status: PathBuf,
    setconf: PathBuf,
    script: PathBuf,
}

fn files(state: &AppState) -> Files {
    let dir = runtime_dir(state);
    Files {
        run: dir.join("awg.run"),
        ready: dir.join("awg.ready"),
        log: dir.join("awg.log"),
        name: dir.join("awg.name"),
        dns: dir.join("awg.dns"),
        status: crate::awg_status::status_file(state),
        setconf: dir.join("awg-setconf.conf"),
        script: dir.join("awg-up.sh"),
    }
}

fn log_tail(path: &Path) -> String {
    let text = std::fs::read_to_string(path).unwrap_or_default();
    let lines: Vec<&str> = text.lines().collect();
    lines[lines.len().saturating_sub(15)..].join("\n")
}

pub async fn connect_profile(
    app: &AppHandle,
    state: &AppState,
    profile: &Profile,
) -> AppResult<ConnectionStatusPayload> {
    let _guard = state.connection.op_lock.lock().await;
    let current_status = state.connection.status.read().await.clone();
    if matches!(current_status.state, ConnectionState::Connected | ConnectionState::Connecting) {
        return Err(AppError::state("A connection operation is already in progress"));
    }

    let config = profile
        .amnezia_config
        .clone()
        .ok_or_else(|| AppError::validation("Amnezia config is missing from the selected profile"))?;
    for binary in [state.paths.amnezia_sidecar_path.clone(), awg_tool(state)] {
        if !binary.exists() {
            return Err(AppError::process(
                "AmneziaWG runtime (amneziawg-go, awg) was not found in the app bundle.",
                Some(binary.display().to_string()),
            ));
        }
    }

    {
        let mut desired = state.connection.desired_profile_id.write().await;
        *desired = Some(profile.id.clone());
    }
    set_status(app, state, connecting(profile)).await?;

    let result = start_tunnel(state, &config).await;
    let interface = match result {
        Ok(interface) => interface,
        Err(error) => {
            let _ = set_status(
                app,
                state,
                ConnectionStatusPayload {
                    state: ConnectionState::Error,
                    active_profile_id: Some(profile.id.clone()),
                    message: Some(error.message.clone()),
                    ..Default::default()
                },
            )
            .await;
            return Err(error);
        }
    };

    let connected_at = Utc::now();
    state.runtime_state.mark_connected(profile.id.clone(), 0, 0, None, None).await?;
    let connected = ConnectionStatusPayload {
        state: ConnectionState::Connected,
        active_profile_id: Some(profile.id.clone()),
        message: Some(format!("Connected via {} (AmneziaWG)", profile.name)),
        connected_at: Some(connected_at),
        local_http_proxy_port: None,
        local_socks_proxy_port: None,
        restart_count: 0,
    };
    {
        let mut session = state.connection.session.lock().await;
        *session = None;
    }
    set_status(app, state, connected.clone()).await?;
    let _ = state
        .log_if_enabled(
            LogSource::Connection,
            LogLevel::Info,
            format!("Connected profile '{}' through AmneziaWG interface {interface}.", profile.name),
        )
        .await;
    spawn_monitor(app.clone(), profile.id.clone());
    Ok(connected)
}

fn connecting(profile: &Profile) -> ConnectionStatusPayload {
    ConnectionStatusPayload {
        state: ConnectionState::Connecting,
        active_profile_id: Some(profile.id.clone()),
        message: Some(format!("Starting AmneziaWG for {}...", profile.name)),
        ..Default::default()
    }
}

async fn start_tunnel(state: &AppState, config: &AmneziaConfig) -> AppResult<String> {
    stop_tunnel().await;
    let files = files(state);
    let endpoint_ip = resolve_endpoint(config)?;
    let endpoint = match endpoint_ip {
        IpAddr::V4(ip) => format!("{ip}:{}", config.endpoint_port),
        IpAddr::V6(ip) => format!("[{ip}]:{}", config.endpoint_port),
    };
    std::fs::write(&files.setconf, setconf_text(&config.raw_config, &endpoint))?;
    std::fs::write(&files.run, b"")?;
    let _ = std::fs::remove_file(&files.ready);
    macos::write_script(&files.script, &build_script(state, config, endpoint_ip, &files))?;

    let mut child = macos::spawn_admin_script(&files.script)?;
    let started = Instant::now();
    loop {
        if let Ok(interface) = std::fs::read_to_string(&files.ready) {
            let interface = interface.trim().to_string();
            if !interface.is_empty() {
                *TUNNEL.lock().unwrap() = Some(Tunnel { child, run_file: files.run.clone() });
                return Ok(interface);
            }
        }
        if let Ok(Some(status)) = child.try_wait() {
            let _ = std::fs::remove_file(&files.run);
            let mut stderr = String::new();
            if let Some(mut pipe) = child.stderr.take() {
                use std::io::Read;
                let _ = pipe.read_to_string(&mut stderr);
            }
            if stderr.contains("-128") {
                return Err(AppError::state("Administrator authorization was cancelled."));
            }
            return Err(AppError::process(
                "AmneziaWG failed to start.",
                Some(format!("{status}; {}\n{}", stderr.trim(), log_tail(&files.log))),
            ));
        }
        if started.elapsed() > START_TIMEOUT {
            let _ = std::fs::remove_file(&files.run);
            let _ = child.kill();
            return Err(AppError::process("Timed out starting AmneziaWG.", Some(log_tail(&files.log))));
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
}

/// Signals the root script to tear the tunnel down and waits for it.
async fn stop_tunnel() {
    let tunnel = TUNNEL.lock().unwrap().take();
    let Some(mut tunnel) = tunnel else { return };
    let _ = std::fs::remove_file(&tunnel.run_file);
    let started = Instant::now();
    while started.elapsed() < STOP_TIMEOUT {
        if matches!(tunnel.child.try_wait(), Ok(Some(_))) {
            return;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    let _ = tunnel.child.kill();
}

/// The tunnel dropped by itself (interface gone, script killed): report it.
fn spawn_monitor(app: AppHandle, profile_id: String) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(2)).await;
            let exited = {
                let mut guard = TUNNEL.lock().unwrap();
                match guard.as_mut() {
                    None => return,
                    Some(tunnel) => matches!(tunnel.child.try_wait(), Ok(Some(_))),
                }
            };
            if !exited {
                continue;
            }
            TUNNEL.lock().unwrap().take();
            let state = app.state::<AppState>();
            let _ = state.runtime_state.clear().await;
            let _ = set_status(
                &app,
                state.inner(),
                ConnectionStatusPayload {
                    state: ConnectionState::Error,
                    active_profile_id: Some(profile_id.clone()),
                    message: Some("AmneziaWG tunnel stopped unexpectedly.".to_string()),
                    ..Default::default()
                },
            )
            .await;
            return;
        }
    });
}

pub async fn disconnect_profile(app: &AppHandle, state: &AppState) -> AppResult<ConnectionStatusPayload> {
    let _guard = state.connection.op_lock.lock().await;
    {
        let mut desired = state.connection.desired_profile_id.write().await;
        *desired = None;
    }
    stop_tunnel().await;
    let _ = std::fs::remove_file(files(state).setconf);
    state.runtime_state.clear().await?;

    let disconnected = ConnectionStatusPayload {
        state: ConnectionState::Disconnected,
        active_profile_id: None,
        message: Some("Disconnected".to_string()),
        ..Default::default()
    };
    set_status(app, state, disconnected.clone()).await?;
    Ok(disconnected)
}

pub async fn test_profile_connection(
    _app: &AppHandle,
    _state: &AppState,
    profile: &Profile,
) -> AppResult<TestConnectionResult> {
    let config = profile
        .amnezia_config
        .as_ref()
        .ok_or_else(|| AppError::validation("Amnezia config is missing from the selected profile"))?;
    Ok(TestConnectionResult {
        profile_id: profile.id.clone(),
        success: true,
        message: format!(
            "AmneziaWG config for '{}' looks structurally valid: endpoint {}:{}.",
            profile.name, config.endpoint_host, config.endpoint_port
        ),
        duration_ms: None,
    })
}

pub async fn cleanup_on_launch(state: &AppState) -> AppResult<()> {
    stop_tunnel().await;
    // A script left from a previous run stops by itself: the app PID it
    // watches is gone. Remove its leftovers.
    let files = files(state);
    for path in [files.run, files.ready, files.setconf, files.status] {
        let _ = std::fs::remove_file(path);
    }
    Ok(())
}

async fn set_status(app: &AppHandle, state: &AppState, status: ConnectionStatusPayload) -> AppResult<()> {
    {
        let mut guard = state.connection.status.write().await;
        *guard = status.clone();
    }
    app.emit("connection-status-changed", status)
        .map_err(|error| AppError::internal("Unable to emit connection status event", Some(error.to_string())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn setconf_drops_wg_quick_keys_and_pins_endpoint() {
        let raw = "[Interface]\nPrivateKey = k\nAddress = 10.8.0.2/32\nDNS = 1.1.1.1\nMTU = 1280\nJc = 4\n\n[Peer]\nPublicKey = p\nEndpoint = host.example:51820\nAllowedIPs = 0.0.0.0/0\n";
        let text = setconf_text(raw, "1.2.3.4:51820");
        assert!(text.contains("PrivateKey = k"));
        assert!(text.contains("Jc = 4"));
        assert!(text.contains("Endpoint = 1.2.3.4:51820"));
        assert!(!text.contains("Address"));
        assert!(!text.contains("DNS"));
        assert!(!text.contains("MTU"));
        assert_eq!(interface_mtu(raw), 1280);
    }

    #[test]
    fn full_tunnel_routes_are_split_halves() {
        let routes = route_commands(&["0.0.0.0/0".into(), "::/0".into()]).join("\n");
        assert!(routes.contains("'0.0.0.0/1'") && routes.contains("'128.0.0.0/1'"));
        assert!(routes.contains("-inet6 '::/1'") && routes.contains("'8000::/1'"));
    }
}
