//! AmneziaWG runtime per platform: the AmneziaWG tunnel service on Windows,
//! amneziawg-go + awg on macOS. Both expose the same functions.

#[cfg(target_os = "windows")]
#[path = "amnezia_manager_windows.rs"]
mod imp;

#[cfg(target_os = "macos")]
#[path = "amnezia_manager_macos.rs"]
mod imp;

pub use imp::{cleanup_on_launch, connect_profile, disconnect_profile, test_profile_connection};
