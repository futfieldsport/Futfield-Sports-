import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type CopyrightStatus = 'CLEAR' | 'WARNING' | 'BLOCKED';
export type CopyrightRiskLevel = 'none' | 'low' | 'high' | 'critical';

export interface CopyrightClaim {
  code: string;
  category: 'drm' | 'broadcaster' | 'metadata' | 'hash_registry' | 'rights_notice';
  match: string;
  severity: 'warning' | 'block';
  reason: string;
}

export interface CopyrightReport {
  status: CopyrightStatus;
  riskLevel: CopyrightRiskLevel;
  confidenceScore: number;
  drmDetected: boolean;
  sha256: string;
  detectedClaims: CopyrightClaim[];
  reason: string;
  scannedAt: string;
  engine: string;
}

interface CopyrightRegistryFile {
  blockedHashes: Array<{ sha256: string; label: string; addedAt: string }>;
  warningHashes: Array<{ sha256: string; label: string; addedAt: string }>;
  totalScans: number;
  totalBlocked: number;
  totalWarnings: number;
  totalCleared: number;
}

const REGISTRY_DIR = path.resolve(process.cwd(), 'uploads');
const REGISTRY_PATH = path.join(REGISTRY_DIR, 'copyright-registry.json');
const ENGINE_NAME = 'FUTFIELD MediaGuard v1.0';

const DRM_ATOMS: Array<{ pattern: RegExp; code: string; label: string }> = [
  { pattern: /\bsinf\b/i, code: 'DRM_SINF_ATOM', label: 'ISO BMFF Protection Scheme Info (sinf)' },
  { pattern: /\bschm\b/i, code: 'DRM_SCHM_ATOM', label: 'ISO BMFF Scheme Type Box (schm)' },
  { pattern: /\bschi\b/i, code: 'DRM_SCHI_ATOM', label: 'ISO BMFF Scheme Information Box (schi)' },
  { pattern: /\btenc\b/i, code: 'DRM_TENC_ATOM', label: 'Common Encryption Track Box (tenc)' },
  { pattern: /\bpssh\b/i, code: 'DRM_PSSH_ATOM', label: 'Protection System Specific Header (pssh)' },
  { pattern: /\bencv\b/i, code: 'DRM_ENCV_CODEC', label: 'Encrypted Video Sample Entry (encv)' },
  { pattern: /\benca\b/i, code: 'DRM_ENCA_CODEC', label: 'Encrypted Audio Sample Entry (enca)' },
  { pattern: /\bwidevine\b/i, code: 'DRM_WIDEVINE', label: 'Google Widevine DRM Signature' },
  { pattern: /\bplayready\b/i, code: 'DRM_PLAYREADY', label: 'Microsoft PlayReady DRM Signature' },
  { pattern: /\bfairplay\b/i, code: 'DRM_FAIRPLAY', label: 'Apple FairPlay DRM Signature' },
];

const BROADCASTER_SIGNATURES: Array<{ pattern: RegExp; code: string; label: string }> = [
  { pattern: /\buefa\s+(official|broadcast|feed|productions|rights)\b/i, code: 'BC_UEFA', label: 'UEFA Protected Broadcast / Competition Feed' },
  { pattern: /\bfifa\s+(official|broadcast|plus|productions)\b/i, code: 'BC_FIFA', label: 'FIFA Official Rights-Holder Content' },
  { pattern: /\bpremier\s+league\s+(official|broadcast|productions)\b/i, code: 'BC_PL_PROD', label: 'Premier League Productions Protected Feed' },
  { pattern: /\bsky\s*sports\b/i, code: 'BC_SKY_SPORTS', label: 'Sky Sports Broadcast Watermark' },
  { pattern: /\bbein\s*sports?\b/i, code: 'BC_BEIN', label: 'beIN SPORTS Broadcast Feed' },
  { pattern: /\btnt\s*sports?\b/i, code: 'BC_TNT', label: 'TNT Sports Broadcast Feed' },
  { pattern: /\bbt\s*sport\b/i, code: 'BC_BT_SPORT', label: 'BT Sport Protected Archive' },
  { pattern: /\bdazn\b/i, code: 'BC_DAZN', label: 'DAZN Live Rights Stream' },
  { pattern: /\bnbc\s*sports?\b/i, code: 'BC_NBC', label: 'NBC Sports Protected Broadcast' },
  { pattern: /\bcbs\s*sports(\s*golazo)?\b/i, code: 'BC_CBS', label: 'CBS Sports Golazo Network Feed' },
  { pattern: /\bespn\s*(\+|plus|fc|deportes)?\b/i, code: 'BC_ESPN', label: 'ESPN+ / ESPN Protected Broadcast' },
  { pattern: /\blaliga\s*(tv|official|broadcast)\b/i, code: 'BC_LALIGA_TV', label: 'LaLiga TV Protected Broadcast' },
  { pattern: /\bsupersport\b/i, code: 'BC_SUPERSPORT', label: 'SuperSport Broadcast Stream' },
  { pattern: /\bcanal\s*\+/i, code: 'BC_CANAL_PLUS', label: 'Canal+ Protected Broadcast' },
  { pattern: /\bsony\s*(ten|liv|sports)\b/i, code: 'BC_SONY_TEN', label: 'Sony Ten / LIV Broadcast Rights' },
  { pattern: /\bstar\s*sports\b/i, code: 'BC_STAR_SPORTS', label: 'Star Sports Broadcast Feed' },
  { pattern: /\boptus\s*sport\b/i, code: 'BC_OPTUS', label: 'Optus Sport Protected Feed' },
  { pattern: /\bdmca\b/i, code: 'BC_DMCA_FLAG', label: 'DMCA Protected Asset Marker' },
  { pattern: /\bcopyrighted\b/i, code: 'BC_COPYRIGHTED', label: 'Explicit Copyrighted Material Marker' },
];

const METADATA_RIGHTS_SIGNATURES: Array<{ pattern: RegExp; code: string; label: string; severity: 'warning' | 'block' }> = [
  { pattern: /©\s*(uefa|fifa|premier league|sky|bein|dazn|espn|nbc|cbs|canal)/i, code: 'META_RIGHTS_HOLDER_SYMBOL', label: 'Rights-Holder © Notice in File Header', severity: 'block' },
  { pattern: /all\s+rights\s+reserved/i, code: 'META_ALL_RIGHTS_RESERVED', label: 'All Rights Reserved Notice Detected', severity: 'warning' },
  { pattern: /<dc:rights>/i, code: 'META_XMP_DC_RIGHTS', label: 'XMP Dublin Core Rights Tag', severity: 'warning' },
  { pattern: /xmprights:marked/i, code: 'META_XMP_MARKED', label: 'XMP Rights Management Flag', severity: 'warning' },
  { pattern: /copyright\s*©/i, code: 'META_COPYRIGHT_NOTICE', label: 'Embedded Copyright © Claim', severity: 'warning' },
  { pattern: /\bcprt\b/i, code: 'META_MP4_CPRT', label: 'MP4 Copyright Metadata Atom (cprt)', severity: 'warning' },
  { pattern: /©cpy/i, code: 'META_QUICKTIME_CPY', label: 'QuickTime Copyright Metadata Atom (©cpy)', severity: 'warning' },
];

function ensureRegistryDir(): void {
  if (!fs.existsSync(REGISTRY_DIR)) {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true });
  }
}

function readRegistry(): CopyrightRegistryFile {
  ensureRegistryDir();
  const defaultRegistry: CopyrightRegistryFile = {
    blockedHashes: [],
    warningHashes: [],
    totalScans: 0,
    totalBlocked: 0,
    totalWarnings: 0,
    totalCleared: 0,
  };
  try {
    if (!fs.existsSync(REGISTRY_PATH)) {
      fs.writeFileSync(REGISTRY_PATH, JSON.stringify(defaultRegistry, null, 2), 'utf8');
      return defaultRegistry;
    }
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CopyrightRegistryFile>;
    return {
      blockedHashes: Array.isArray(parsed.blockedHashes) ? parsed.blockedHashes : [],
      warningHashes: Array.isArray(parsed.warningHashes) ? parsed.warningHashes : [],
      totalScans: typeof parsed.totalScans === 'number' ? parsed.totalScans : 0,
      totalBlocked: typeof parsed.totalBlocked === 'number' ? parsed.totalBlocked : 0,
      totalWarnings: typeof parsed.totalWarnings === 'number' ? parsed.totalWarnings : 0,
      totalCleared: typeof parsed.totalCleared === 'number' ? parsed.totalCleared : 0,
    };
  } catch {
    return defaultRegistry;
  }
}

function writeRegistry(registry: CopyrightRegistryFile): void {
  try {
    ensureRegistryDir();
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
  } catch (err) {
    console.warn('[MediaGuard] Failed to persist copyright registry:', err);
  }
}

function extractPrintableWindows(buffer: Buffer): string {
  // Inspect head + tail slices (and up to first 512KB) for container atoms & XMP/rights metadata
  const maxInspect = 512 * 1024;
  let combined = '';
  if (buffer.length <= maxInspect) {
    combined = buffer.toString('latin1');
  } else {
    const head = buffer.subarray(0, 256 * 1024).toString('latin1');
    const tail = buffer.subarray(buffer.length - 256 * 1024).toString('latin1');
    combined = `${head}\n${tail}`;
  }
  return combined.replace(/[^\x20-\x7E\u00A0-\u00FF]+/g, ' ');
}

export interface AnalyzeVideoCopyrightInput {
  buffer?: Buffer | null;
  fileName?: string;
  title?: string;
  description?: string;
  videoUrl?: string;
  hashtags?: string[];
  clubTag?: string;
  skipMetricsIncrement?: boolean;
}

export function analyzeVideoCopyright(input: AnalyzeVideoCopyrightInput): CopyrightReport {
  const {
    buffer = null,
    fileName = '',
    title = '',
    description = '',
    videoUrl = '',
    hashtags = [],
    skipMetricsIncrement = false,
  } = input;

  const textComposite = [
    fileName,
    title,
    description,
    videoUrl,
    ...(Array.isArray(hashtags) ? hashtags : []),
  ]
    .filter(Boolean)
    .join(' | ');

  const hashInput = buffer && buffer.length > 0 ? buffer : Buffer.from(textComposite || 'empty-payload', 'utf8');
  const sha256 = crypto.createHash('sha256').update(hashInput).digest('hex');

  const registry = readRegistry();
  const detectedClaims: CopyrightClaim[] = [];
  let drmDetected = false;

  // 1. Check SHA-256 hash registry
  const blockedHashMatch = registry.blockedHashes.find((item) => item.sha256.toLowerCase() === sha256.toLowerCase());
  if (blockedHashMatch) {
    detectedClaims.push({
      code: 'HASH_BLOCKED',
      category: 'hash_registry',
      match: blockedHashMatch.label || sha256.slice(0, 12),
      severity: 'block',
      reason: `Exact SHA-256 match found in blocked rights registry (${blockedHashMatch.label}).`,
    });
  }

  const warningHashMatch = registry.warningHashes.find((item) => item.sha256.toLowerCase() === sha256.toLowerCase());
  if (warningHashMatch) {
    detectedClaims.push({
      code: 'HASH_WARNING',
      category: 'hash_registry',
      match: warningHashMatch.label || sha256.slice(0, 12),
      severity: 'warning',
      reason: `SHA-256 fingerprint matches flagged reference (${warningHashMatch.label}).`,
    });
  }

  // 2. Binary container DRM & metadata atom inspection
  const printableBufferText = buffer && buffer.length > 0 ? extractPrintableWindows(buffer) : '';
  if (printableBufferText) {
    for (const atom of DRM_ATOMS) {
      if (atom.pattern.test(printableBufferText)) {
        drmDetected = true;
        detectedClaims.push({
          code: atom.code,
          category: 'drm',
          match: atom.label,
          severity: 'block',
          reason: `Encrypted or DRM-protected container atom detected: ${atom.label}.`,
        });
      }
    }

    for (const metaSig of METADATA_RIGHTS_SIGNATURES) {
      if (metaSig.pattern.test(printableBufferText)) {
        detectedClaims.push({
          code: metaSig.code,
          category: 'metadata',
          match: metaSig.label,
          severity: metaSig.severity,
          reason: `File metadata contains protected rights notice: ${metaSig.label}.`,
        });
      }
    }
  }

  // 3. Broadcaster & rights-holder keyword inspection across filename, metadata, title, description, tags, URL, and binary strings
  const fullInspectString = `${textComposite} ${printableBufferText}`;
  for (const broadcaster of BROADCASTER_SIGNATURES) {
    const match = fullInspectString.match(broadcaster.pattern);
    if (match) {
      detectedClaims.push({
        code: broadcaster.code,
        category: 'broadcaster',
        match: match[0],
        severity: 'block',
        reason: `Protected broadcaster / competition rights signature matched: "${match[0]}" (${broadcaster.label}).`,
      });
    }
  }

  // Also check rights-notice patterns in user text metadata
  for (const metaSig of METADATA_RIGHTS_SIGNATURES) {
    if (metaSig.pattern.test(textComposite)) {
      if (!detectedClaims.some((c) => c.code === metaSig.code)) {
        detectedClaims.push({
          code: metaSig.code,
          category: 'rights_notice',
          match: metaSig.label,
          severity: metaSig.severity,
          reason: `Rights notice matched in metadata: ${metaSig.label}.`,
        });
      }
    }
  }

  // Deduplicate claims by code
  const uniqueClaims: CopyrightClaim[] = [];
  const seenCodes = new Set<string>();
  for (const claim of detectedClaims) {
    if (!seenCodes.has(claim.code)) {
      seenCodes.add(claim.code);
      uniqueClaims.push(claim);
    }
  }

  const hasBlock = uniqueClaims.some((c) => c.severity === 'block');
  const hasWarning = uniqueClaims.some((c) => c.severity === 'warning');

  let status: CopyrightStatus = 'CLEAR';
  let riskLevel: CopyrightRiskLevel = 'none';
  let confidenceScore = 0;

  if (hasBlock) {
    status = 'BLOCKED';
    riskLevel = drmDetected || blockedHashMatch ? 'critical' : 'high';
    confidenceScore = Math.min(100, 82 + uniqueClaims.length * 6);
  } else if (hasWarning) {
    status = 'WARNING';
    riskLevel = 'low';
    confidenceScore = Math.min(74, 30 + uniqueClaims.length * 14);
  }

  const reason =
    status === 'BLOCKED'
      ? uniqueClaims.find((c) => c.severity === 'block')?.reason ||
        'Protected broadcast or DRM-encrypted material blocked by MediaGuard.'
      : status === 'WARNING'
      ? uniqueClaims[0]?.reason || 'Rights metadata flag detected; manual review advised.'
      : 'No DRM atoms, blocked hashes, or broadcaster watermarks detected.';

  if (!skipMetricsIncrement) {
    registry.totalScans += 1;
    if (status === 'BLOCKED') registry.totalBlocked += 1;
    else if (status === 'WARNING') registry.totalWarnings += 1;
    else registry.totalCleared += 1;
    writeRegistry(registry);
  }

  return {
    status,
    riskLevel,
    confidenceScore,
    drmDetected,
    sha256,
    detectedClaims: uniqueClaims,
    reason,
    scannedAt: new Date().toISOString(),
    engine: ENGINE_NAME,
  };
}

export function getCopyrightEngineStatus() {
  const registry = readRegistry();
  return {
    active: true,
    engine: ENGINE_NAME,
    totalScans: registry.totalScans,
    totalBlocked: registry.totalBlocked,
    totalWarnings: registry.totalWarnings,
    totalCleared: registry.totalCleared,
    blockedHashesCount: registry.blockedHashes.length,
    warningHashesCount: registry.warningHashes.length,
    activeRulesCount: DRM_ATOMS.length + BROADCASTER_SIGNATURES.length + METADATA_RIGHTS_SIGNATURES.length,
    rulesBreakdown: {
      drmAtoms: DRM_ATOMS.length,
      broadcasterSignatures: BROADCASTER_SIGNATURES.length,
      metadataRightsRules: METADATA_RIGHTS_SIGNATURES.length,
    },
  };
}

export function manageCopyrightRegistry(action: 'add' | 'remove', sha256: string, label = 'Registered Copyright Asset', level: 'blocked' | 'warning' = 'blocked') {
  const cleanHash = String(sha256 || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(cleanHash)) {
    throw new Error('Invalid SHA-256 hash. Expected 64 hexadecimal characters.');
  }

  const registry = readRegistry();
  const targetKey = level === 'warning' ? 'warningHashes' : 'blockedHashes';

  if (action === 'add') {
    registry.blockedHashes = registry.blockedHashes.filter((h) => h.sha256 !== cleanHash);
    registry.warningHashes = registry.warningHashes.filter((h) => h.sha256 !== cleanHash);
    registry[targetKey].unshift({
      sha256: cleanHash,
      label: String(label || 'Registered Copyright Asset').slice(0, 120),
      addedAt: new Date().toISOString(),
    });
  } else {
    registry.blockedHashes = registry.blockedHashes.filter((h) => h.sha256 !== cleanHash);
    registry.warningHashes = registry.warningHashes.filter((h) => h.sha256 !== cleanHash);
  }

  writeRegistry(registry);
  return getCopyrightEngineStatus();
}
