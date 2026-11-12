//! Live AmneziaWG tunnel status: handshake time, transferred bytes and the
//! endpoint, parsed from `awg show <interface> dump`.
//!
//! Windows runs the bundled `awg.exe` directly (the app is elevated for AWG).
//! macOS `awg` needs root, so the root helper script writes the dump into a
//! user-readable status file every couple of seconds and this module reads it.

use crate::{
    error::AppResult,
    models::{AwgStatus, ConnectionState, ProfileEngine},
    state::AppState,
};

/// First peer of `awg show <interface> dump`. The first line describes the
/// interface itself and is skipped; peer lines are tab separated:
/// `public-key preshared-key endpoint allowed-ips latest-handshake rx tx keepalive`.
pub fn parse_dump(dump: &str) -> Option<AwgStatus> {
    let line = dump.lines().map(str::trim_end).filter(|line| !line.is_empty()).nth(1)?;
    let fields: Vec<&str> = line.split('\t').collect();
    if fields.len() < 7 {
        return None;
    }
    let handshake: i64 = fields[4].trim().parse().ok()?;
    let rx_bytes: u64 = fields[5].trim().parse().ok()?;
    let tx_bytes: u64 = fields[6].trim().parse().ok()?;
    let endpoint = match fields[2].trim() {
        "" | "(none)" => None,
        value => Some(value.to_string()),
    };
    Some(AwgStatus {
        latest_handshake_at: (handshake > 0).then_some(handshake),
        rx_bytes,
        tx_bytes,
        endpoint,
    })
}

/// Name of the status file the macOS root script writes (next to the other
/// AmneziaWG runtime files).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn status_file(state: &AppState) -> std::path::PathBuf {
    state
        .paths
        .amnezia_config_file
        .with_file_name("awg.status")
}

/// `Ok(None)` when no AmneziaWG session is active or the source is not available.
pub async fn read_status(state: &AppState) -> AppResult<Option<AwgStatus>> {
    let status = state.connection.status.read().await.clone();
    if status.state != ConnectionState::Connected {
        return Ok(None);
    }
    let Some(profile_id) = status.active_profile_id else {
        return Ok(None);
    };
    let is_awg = state
        .profile_store
        .get(&profile_id)
        .await
        .map(|profile| profile.engine == ProfileEngine::Amneziawg)
        .unwrap_or(false);
    if !is_awg {
        return Ok(None);
    }
    Ok(read_dump(state).await.and_then(|dump| parse_dump(&dump)))
}

#[cfg(target_os = "windows")]
async fn read_dump(state: &AppState) -> Option<String> {
    let awg = state.paths.amnezia_sidecar_path.with_file_name("awg.exe");
    if !awg.exists() {
        return None;
    }
    let tunnel = state
        .paths
        .amnezia_config_file
        .file_stem()?
        .to_string_lossy()
        .to_string();
    let dir = awg.parent().map(|path| path.to_path_buf());
    tokio::task::spawn_blocking(move || {
        let mut command = crate::platform::command(awg);
        if let Some(dir) = dir {
            command.current_dir(dir);
        }
        let output = command.args(["show", tunnel.as_str(), "dump"]).output().ok()?;
        output
            .status
            .success()
            .then(|| String::from_utf8_lossy(&output.stdout).to_string())
    })
    .await
    .ok()
    .flatten()
}

#[cfg(target_os = "macos")]
async fn read_dump(state: &AppState) -> Option<String> {
    let path = status_file(state);
    let modified = std::fs::metadata(&path).ok()?.modified().ok()?;
    // The script refreshes the file every ~2 s; an old file is a dead tunnel.
    if modified.elapsed().map(|age| age.as_secs() > 15).unwrap_or(true) {
        return None;
    }
    std::fs::read_to_string(path).ok()
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
async fn read_dump(_state: &AppState) -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_first_peer() {
        let dump = "privkey\tpubkey\t51820\toff\t4\t5\n\
                    peerkey\t(none)\t1.2.3.4:51820\t0.0.0.0/0\t1794500000\t1048576\t2048\toff\n";
        let status = parse_dump(dump).expect("status");
        assert_eq!(status.latest_handshake_at, Some(1794500000));
        assert_eq!(status.rx_bytes, 1_048_576);
        assert_eq!(status.tx_bytes, 2048);
        assert_eq!(status.endpoint.as_deref(), Some("1.2.3.4:51820"));
    }

    #[test]
    fn no_handshake_and_no_endpoint_become_none() {
        let dump = "privkey\tpubkey\t51820\toff\n\
                    peerkey\t(none)\t(none)\t0.0.0.0/0\t0\t0\t0\toff\n";
        let status = parse_dump(dump).expect("status");
        assert_eq!(status.latest_handshake_at, None);
        assert_eq!(status.endpoint, None);
        assert_eq!(status.rx_bytes, 0);
    }

    #[test]
    fn empty_and_garbage_are_none() {
        assert!(parse_dump("").is_none());
        assert!(parse_dump("oops").is_none());
        assert!(parse_dump("a\nb\tc").is_none());
    }
}
