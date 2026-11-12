//! In-app updates from GitHub Releases (tauri-plugin-updater).
//!
//! Releases publish `latest.json` plus signed installers; the public key and
//! the endpoint live in tauri.conf.json (`plugins.updater`). The commands are
//! ours instead of the JS plugin API: the JS packages already require a newer
//! Tauri than the pinned one.

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;

use crate::{
    connection_manager,
    error::{AppError, AppResult},
    models::ConnectionState,
    state::AppState,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub current_version: String,
    pub version: String,
    pub notes: Option<String>,
    pub date: Option<String>,
}

fn updater_error(error: impl std::fmt::Display) -> AppError {
    AppError::process("Update check failed", Some(error.to_string()))
}

/// `None` when the app is up to date.
pub async fn check(app: &AppHandle) -> AppResult<Option<UpdateInfo>> {
    let update = app
        .updater()
        .map_err(updater_error)?
        .check()
        .await
        .map_err(updater_error)?;
    Ok(update.map(|update| UpdateInfo {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        notes: update.body.clone(),
        date: update.date.map(|date| date.to_string()),
    }))
}

/// Downloads, verifies the signature, installs and restarts. The active
/// connection is closed first so the system proxy / tunnel is restored before
/// the installer replaces the app.
pub async fn install(app: &AppHandle) -> AppResult<()> {
    let update = app
        .updater()
        .map_err(updater_error)?
        .check()
        .await
        .map_err(updater_error)?
        .ok_or_else(|| AppError::state("VeilBox is already up to date"))?;

    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|error| AppError::process("Update download failed", Some(error.to_string())))?;

    let state = app.state::<AppState>();
    let status = connection_manager::connection_status(state.inner()).await;
    if matches!(status.state, ConnectionState::Connected | ConnectionState::Connecting) {
        let _ = connection_manager::disconnect_profile(app, state.inner()).await;
    }

    update
        .install(bytes)
        .map_err(|error| AppError::process("Update install failed", Some(error.to_string())))?;
    app.restart();
}
