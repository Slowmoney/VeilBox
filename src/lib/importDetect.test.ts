import { describe, expect, it } from 'vitest';
import { detectImportKind } from './importDetect';

describe('detectImportKind', () => {
  it('detects subscription urls', () => {
    expect(detectImportKind('https://x/sub')).toBe('subscription');
  });
  it('detects proxy uris case-insensitively and trims', () => {
    expect(detectImportKind('vless://abc@host:443')).toBe('proxyUri');
    expect(detectImportKind('  SS://abc')).toBe('proxyUri');
    expect(detectImportKind('hy2://pass@host')).toBe('proxyUri');
    expect(detectImportKind('Hysteria2://pass@host')).toBe('proxyUri');
  });
  it('detects amnezia vpn:// links', () => {
    expect(detectImportKind('vpn://AAAA')).toBe('amneziaUri');
  });
  it('detects an AmneziaWG config', () => {
    expect(detectImportKind('[Interface]\nPrivateKey = k\n\n[Peer]\nPublicKey = p')).toBe('amneziaConfig');
  });
  it('detects JSON', () => {
    expect(detectImportKind('{"a":1}')).toBe('json');
    expect(detectImportKind('[{"a":1}]')).toBe('json');
  });
  it('rejects a lone [Interface], garbage and empty text', () => {
    expect(detectImportKind('[Interface]\nPrivateKey = k')).toBe('unknown');
    expect(detectImportKind('hello')).toBe('unknown');
    expect(detectImportKind('')).toBe('unknown');
  });
});
