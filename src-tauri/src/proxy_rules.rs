//! System proxy bypass rules and PAC generation shared by the Windows and
//! macOS proxy managers (pure logic, no platform APIs).

use std::{fs, net::Ipv4Addr, path::Path};

use crate::{
    error::{AppError, AppResult},
    models::{ConnectionMode, Settings, SplitTunnelMode},
};

pub(crate) fn build_proxy_override(settings: &Settings) -> AppResult<String> {
    let mut entries = vec!["<local>".to_string()];

    if !matches!(settings.connection_mode, ConnectionMode::SystemProxy) {
        return Ok(entries.join(";"));
    }

    if matches!(settings.split_tunnel_mode, SplitTunnelMode::BypassListed) {
        for domain in &settings.split_tunnel_domains {
            entries.extend(domain_to_proxy_override(domain)?);
        }
        for ip in &settings.split_tunnel_ips {
            entries.extend(ip_to_proxy_override(ip)?);
        }
    }

    entries.sort();
    entries.dedup();
    Ok(entries.join(";"))
}

pub(crate) fn pac_url_from_path(path: &Path) -> String {
    let normalized = path.to_string_lossy().replace('\\', "/");
    // Unix paths already start with '/'; Windows paths start with a drive letter.
    if normalized.starts_with('/') {
        format!("file://{normalized}")
    } else {
        format!("file:///{normalized}")
    }
}

pub(crate) fn write_proxy_pac(port: u16, settings: &Settings, pac_path: &Path) -> AppResult<()> {
    let script = build_proxy_pac_script(port, settings)?;
    fs::write(pac_path, script)
        .map_err(|error| AppError::proxy("Failed to write PAC file for system proxy mode", Some(error.to_string())))
}

pub(crate) fn build_proxy_pac_script(port: u16, settings: &Settings) -> AppResult<String> {
    let proxy = format!("PROXY 127.0.0.1:{port}");
    let mut rules = Vec::new();

    for domain in &settings.split_tunnel_domains {
        rules.extend(domain_to_pac_checks(domain)?);
    }
    for ip in &settings.split_tunnel_ips {
        rules.extend(ip_to_pac_checks(ip)?);
    }

    let rules_block = if rules.is_empty() {
        String::new()
    } else {
        format!("  if ({}) return \"{proxy}\";\n", rules.join(" ||\n      "))
    };

    Ok(format!(
        "function FindProxyForURL(url, host) {{\n  if (isPlainHostName(host) || dnsDomainIs(host, \".local\") || shExpMatch(host, \"localhost*\")) return \"DIRECT\";\n{rules_block}  return \"DIRECT\";\n}}\n"
    ))
}

pub(crate) fn domain_to_proxy_override(value: &str) -> AppResult<Vec<String>> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    if let Some(domain) = trimmed.strip_prefix("full:") {
        return Ok(vec![domain.trim().to_string()]);
    }
    if let Some(domain) = trimmed.strip_prefix("domain:") {
        return Ok(domain_patterns(domain.trim()));
    }
    if let Some(keyword) = trimmed.strip_prefix("keyword:") {
        let keyword = keyword.trim();
        return Ok(vec![format!("*{keyword}*")]);
    }
    if trimmed.starts_with("regexp:") || trimmed.starts_with("geosite:") || trimmed.starts_with("ext:") {
        return Err(AppError::validation(format!(
            "Entry '{}' is not supported in System Proxy mode. Use plain domain, full: or keyword:.",
            trimmed
        )));
    }

    Ok(domain_patterns(trimmed))
}

pub(crate) fn domain_to_pac_checks(value: &str) -> AppResult<Vec<String>> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    if let Some(domain) = trimmed.strip_prefix("full:") {
        let domain = domain.trim();
        return Ok(vec![format!("host == \"{domain}\"")]);
    }
    if let Some(domain) = trimmed.strip_prefix("domain:") {
        return Ok(pac_domain_checks(domain.trim()));
    }
    if let Some(keyword) = trimmed.strip_prefix("keyword:") {
        let keyword = keyword.trim();
        return Ok(vec![
            format!("shExpMatch(host, \"*{keyword}*\")"),
            format!("shExpMatch(url, \"*{keyword}*\")"),
        ]);
    }
    if trimmed.starts_with("regexp:") || trimmed.starts_with("geosite:") || trimmed.starts_with("ext:") {
        return Err(AppError::validation(format!(
            "Entry '{}' is not supported in System Proxy PAC mode. Use plain domain, full: or keyword:.",
            trimmed
        )));
    }

    Ok(pac_domain_checks(trimmed))
}

pub(crate) fn domain_patterns(domain: &str) -> Vec<String> {
    let normalized = domain.trim().trim_start_matches("*.").trim_matches('.');
    if normalized.is_empty() {
        return Vec::new();
    }

    vec![normalized.to_string(), format!("*.{normalized}")]
}

pub(crate) fn pac_domain_checks(domain: &str) -> Vec<String> {
    let normalized = domain.trim().trim_start_matches("*.").trim_matches('.');
    if normalized.is_empty() {
        return Vec::new();
    }

    vec![
        format!("host == \"{normalized}\""),
        format!("dnsDomainIs(host, \".{normalized}\")"),
    ]
}

pub(crate) fn ip_to_proxy_override(value: &str) -> AppResult<Vec<String>> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    if let Ok(ip) = trimmed.parse::<Ipv4Addr>() {
        return Ok(vec![ip.to_string()]);
    }

    let Some((ip_text, prefix_text)) = trimmed.split_once('/') else {
        return Err(AppError::validation(format!(
            "Entry '{}' is not supported in System Proxy mode. Use IPv4 address or CIDR.",
            trimmed
        )));
    };

    let ip = ip_text.parse::<Ipv4Addr>().map_err(|_| {
        AppError::validation(format!(
            "Entry '{}' is not supported in System Proxy mode. Only IPv4 is supported.",
            trimmed
        ))
    })?;
    let prefix = prefix_text.parse::<u8>().map_err(|_| {
        AppError::validation(format!("Invalid CIDR prefix in '{}'.", trimmed))
    })?;

    match prefix {
        32 => Ok(vec![ip.to_string()]),
        24 => {
            let [a, b, c, _] = ip.octets();
            Ok(vec![format!("{a}.{b}.{c}.*")])
        }
        16 => {
            let [a, b, _, _] = ip.octets();
            Ok(vec![format!("{a}.{b}.*")])
        }
        8 => {
            let [a, _, _, _] = ip.octets();
            Ok(vec![format!("{a}.*")])
        }
        12 => {
            let [a, b, _, _] = ip.octets();
            if a != 172 || !(16..=31).contains(&b) {
                return Err(AppError::validation(format!(
                    "CIDR '{}' cannot be represented through System Proxy. Supported: /8, /16, /24, /32 and the local network 172.16.0.0/12.",
                    trimmed
                )));
            }
            Ok((16u8..=31u8).map(|octet| format!("172.{octet}.*")).collect())
        }
        _ => Err(AppError::validation(format!(
            "CIDR '{}' is not supported in System Proxy mode. Supported: /8, /12, /16, /24, /32.",
            trimmed
        ))),
    }
}

pub(crate) fn ip_to_pac_checks(value: &str) -> AppResult<Vec<String>> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    if let Ok(ip) = trimmed.parse::<Ipv4Addr>() {
        return Ok(vec![format!("dnsResolve(host) == \"{ip}\"")]);
    }

    let Some((ip_text, prefix_text)) = trimmed.split_once('/') else {
        return Err(AppError::validation(format!(
            "Entry '{}' is not supported in System Proxy PAC mode. Use IPv4 address or CIDR.",
            trimmed
        )));
    };

    let ip = ip_text.parse::<Ipv4Addr>().map_err(|_| {
        AppError::validation(format!(
            "Entry '{}' is not supported in System Proxy PAC mode. Only IPv4 is supported.",
            trimmed
        ))
    })?;
    let prefix = prefix_text.parse::<u8>().map_err(|_| {
        AppError::validation(format!("Invalid CIDR prefix in '{}'.", trimmed))
    })?;

    let mask = match prefix {
        32 => "255.255.255.255".to_string(),
        24 => "255.255.255.0".to_string(),
        16 => "255.255.0.0".to_string(),
        12 => "255.240.0.0".to_string(),
        8 => "255.0.0.0".to_string(),
        _ => {
            return Err(AppError::validation(format!(
                "CIDR '{}' is not supported in System Proxy PAC mode. Supported: /8, /12, /16, /24, /32.",
                trimmed
            )))
        }
    };

    Ok(vec![format!(
        "isInNet(dnsResolve(host), \"{}\", \"{}\")",
        ip, mask
    )])
}
