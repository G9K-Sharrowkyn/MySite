import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from common locations (backend folder or repo root). dotenv won't override
// already-defined environment variables, so VPS/systemd values still win.
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production') });
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import http from 'http';
import { randomInt } from 'crypto';
import { readFile } from 'fs/promises';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import {
  addMessage as addLocalMessage,
  addReaction as addLocalReaction,
  getRecentMessages as getLocalRecentMessages,
  trimMessages as trimLocalMessages
} from './services/chatStore.js';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import fightRoutes from './routes/fights.js';
import commentRoutes from './routes/comments.js';
import postRoutes from './routes/posts.js';
import characterRoutes from './routes/characters.js';
import messageRoutes from './routes/messages.js';
import voteRoutes from './routes/votes.js';
import divisionsRoutes, { runDivisionSeasonScheduler } from './routes/divisions.js';
import notificationRoutes from './routes/notifications.js';
import tournamentRoutes from './routes/tournaments.js';
import statsRoutes from './routes/stats.js';
import badgeRoutes from './routes/badges.js';
import bettingRoutes from './routes/betting.js';
import tagRoutes from './routes/tags.js';
import privacyRoutes from './routes/privacy.js';
import usersRoutes from './routes/users.js';
import coinsRoutes from './routes/coins.js';
import communityRoutes from './routes/community.js';
import donationsRoutes from './routes/donations.js';
import legalRoutes from './routes/legal.js';
import recommendationsRoutes from './routes/recommendations.js';
import challengesRoutes from './routes/challenges.js';
import storeRoutes from './routes/store.js';
import userRoutes from './routes/user.js';
import pushRoutes from './routes/push.js';
import feedbackRoutes from './routes/feedback.js';
import moderationRoutes from './routes/moderation.js';
import translateRoutes from './routes/translate.js';
import ccgRoutes from './routes/ccg.js';
import friendsRoutes from './routes/friends.js';
import blocksRoutes from './routes/blocks.js';
import swoopRoutes from './routes/swoop.js';
import tronRoutes from './routes/tron.js';
import './jobs/tournamentScheduler.js'; // Initialize tournament scheduler
import {
  charactersRepo,
  notificationsRepo,
  postsRepo,
  usersRepo
} from './repositories/index.js';
import {
  assertProductionDatabaseConfiguration,
  checkDatabaseHealth,
  closeDb,
  verifyProductionDatabaseCapabilities
} from './services/jsonDb.js';
import { getCharacterMediaById } from './services/characterMedia.js';
import { loadBuiltInCharacterCatalog } from './services/characterCatalog.js';
import { initTronNamespace } from './realtime/tronArena.js';
import { assertEmailConfiguration } from './services/emailService.js';
import { getAuthCookieToken } from './utils/authCookie.js';
import { getUploadsRoot } from './utils/uploadFiles.js';
import {
  closeSocketRedisAdapter,
  configureSocketRedisAdapter,
  createRedisRateLimitStore
} from './services/socketRedisAdapter.js';
import { assertProductionLegalConfiguration } from './config/legalConfig.js';
import {
  assertProductionRuntimeConfiguration,
  isBackgroundJobsAuthority,
  isTronRealtimeAuthority
} from './config/runtimeConfig.js';
import authMiddleware from './middleware/authMiddleware.js';
import {
  decodeSafeDataImage,
  fetchTrustedImageBuffer,
  MAX_IMAGE_INPUT_PIXELS,
  normalizeSafeImageSource,
  renderSafeImageDataUri
} from './utils/imageSecurity.js';

const chatStore = {
  getRecentMessages: getLocalRecentMessages,
  addMessage: addLocalMessage,
  addReaction: addLocalReaction,
  trimMessages: trimLocalMessages
};
const app = express();
const PORT = process.env.PORT || 5000;
let socketAdapterState = { enabled: false };
assertEmailConfiguration();
assertProductionDatabaseConfiguration();
assertProductionLegalConfiguration();
assertProductionRuntimeConfiguration();
const shouldTrustProxy =
  process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production';
if (shouldTrustProxy) {
  app.set('trust proxy', 1);
}

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeMetaText = (value, maxLength) => {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
  if (!maxLength || cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1)}…`;
};

const normalizeCharacterKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

let cachedIndexHtml = null;

const findCharacterImage = (name, characters = []) => {
  if (!name) return '';
  const key = normalizeCharacterKey(name);
  if (!key) return '';
  const match = characters.find((entry) => {
    const candidates = [entry?.name, entry?.baseName, entry?.characterName];
    return candidates.some((candidate) => normalizeCharacterKey(candidate) === key);
  });
  return match?.image || match?.characterImage || '';
};

const normalizeBaseUrl = (value) => String(value || '').replace(/\/$/, '');

const buildAbsoluteUrl = (baseUrl, rawPath) => {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  if (!normalizedBase) return rawPath;
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return `${normalizedBase}${normalizedPath}`;
};

const normalizeCharacterAssetPath = (value) => {
  if (!value) return value;
  let decoded = String(value);
  try {
    decoded = decodeURIComponent(decoded);
  } catch (_error) {
    decoded = String(value);
  }
  if (decoded.startsWith('/characters/') && decoded.includes('(SW)')) {
    decoded = decoded.replace(/\(SW\)/g, '(Star Wars)');
  }
  return decoded;
};

const splitFightTeamMembers = (value) => {
  const raw = String(value || '');
  if (!raw.trim()) return [];

  const out = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '(') {
      parenDepth += 1;
      current += ch;
      continue;
    }
    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += ch;
      continue;
    }
    if (ch === ',' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) out.push(trimmed);
      current = '';
      continue;
    }
    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) out.push(trimmed);
  return out;
};

const normalizeTeamLabel = (value) =>
  splitFightTeamMembers(value).join(', ');

const pickPrimaryTeamName = (value) =>
  splitFightTeamMembers(value)[0] || '';

const truncateText = (value, maxLength) => {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
  if (!maxLength || cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3)}...`;
};

const splitTextLines = (value, maxCharsPerLine, maxLines = 2) => {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const words = cleaned.split(' ');
  const lines = [];
  let current = '';
  let index = 0;
  let forcedTruncation = false;

  while (index < words.length && lines.length < maxLines) {
    const word = words[index];
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      index += 1;
      continue;
    }
    if (current) {
      lines.push(current);
      current = '';
      continue;
    }
    // A single "word" is longer than the line: hard-truncate and mark so we add ellipsis.
    lines.push(truncateText(word, maxCharsPerLine));
    forcedTruncation = true;
    index += 1;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  const usedLength = lines.join(' ').length;
  if ((forcedTruncation || usedLength < cleaned.length) && lines.length) {
    lines[lines.length - 1] = truncateText(lines[lines.length - 1], maxCharsPerLine);
  }

  return lines;
};

const normalizeCharacterNameForShare = (value) =>
  String(value || '')
    // Many names are stored like "(Whitebeard)(One Piece)" which becomes one long token. Give it wrap points.
    .replace(/\)\(/g, ') (')
    .replace(/\s+/g, ' ')
    .trim();

const resolveAssetUrl = (raw, options = {}) => {
  if (!raw) return '';
  const allowedOrigins = [options.imageBaseUrl, options.apiBaseUrl, options.baseUrl]
    .filter(Boolean);
  if (/^(data:|https?:\/\/)/i.test(raw)) {
    return normalizeSafeImageSource(raw, { allowedOrigins }) || '';
  }
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  const base =
    normalized.startsWith('/uploads/') ||
    normalized.startsWith('/api/uploads/') ||
    normalized.startsWith('/api/media/')
      ? normalizeBaseUrl(options.apiBaseUrl)
      : normalizeBaseUrl(options.imageBaseUrl || options.baseUrl);
  if (!base) {
    return normalizeSafeImageSource(normalized, { allowedOrigins }) || '';
  }
  const resolved = buildAbsoluteUrl(base, normalized);
  return normalizeSafeImageSource(resolved, { allowedOrigins }) || '';
};

const buildFallbackSvgDataUri = (label) => {
  const safeLabel = escapeHtml(truncateText(label || 'VVV', 12));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <rect width="600" height="600" fill="#1f2937" />
      <text x="300" y="320" font-family="Arial, Helvetica, sans-serif" font-size="48" fill="#f8fafc" text-anchor="middle">
        ${safeLabel}
      </text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const fetchImageDataUri = async (source, allowedOrigins = []) => {
  if (!source) return null;
  try {
    const normalized = normalizeSafeImageSource(source, { allowedOrigins });
    if (!normalized) return null;

    const embedded = decodeSafeDataImage(normalized);
    if (embedded) {
      return await renderSafeImageDataUri(embedded.buffer);
    }

    const fetched = await fetchTrustedImageBuffer(normalized, {
      allowedOrigins,
      allowPrivateNetwork: process.env.NODE_ENV !== 'production'
    });
    return fetched ? await renderSafeImageDataUri(fetched.buffer) : null;
  } catch (_error) {
    return null;
  }
};

const resolveCharacterImageByName = async (name, db) => {
  if (!name) return '';
  const dbCharacters = Array.isArray(db?.characters) ? db.characters : [];
  const image = findCharacterImage(name, dbCharacters);
  return normalizeCharacterAssetPath(image || '');
};

const escapeRegex = (value) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const loadShareContext = async (postId) => {
  const post = await postsRepo.findById(postId);
  if (!post) return { post: null, db: { characters: [] } };

  const characterNames = [...new Set([
    ...splitFightTeamMembers(post?.fight?.teamA),
    ...splitFightTeamMembers(post?.fight?.teamB)
  ].filter(Boolean))].slice(0, 20);
  if (characterNames.length === 0) {
    return { post, db: { characters: [] } };
  }

  const normalizedNames = new Set(characterNames.map(normalizeCharacterKey));
  const builtInMatches = (await loadBuiltInCharacterCatalog()).filter((character) =>
    normalizedNames.has(normalizeCharacterKey(character.name))
  );
  const storedMatches = (await Promise.all(
    characterNames.map((name) =>
      charactersRepo.findOneBy({
        name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
      })
    )
  )).filter(Boolean);

  const byName = new Map(
    builtInMatches.map((character) => [normalizeCharacterKey(character.name), character])
  );
  for (const character of storedMatches) {
    const key = normalizeCharacterKey(character.name);
    byName.set(key, { ...(byName.get(key) || {}), ...character });
  }
  return { post, db: { characters: [...byName.values()] } };
};

const toCharacterThumbPath = (assetPath) => {
  const raw = String(assetPath || '');
  if (!raw) return '';
  if (!raw.startsWith('/characters/')) return raw;
  if (raw.startsWith('/characters/thumbs/')) return raw;
  const filename = raw.split('/').pop() || '';
  if (!filename) return raw;
  return `/characters/thumbs/${filename}`;
};

const SHARE_IMAGE_WIDTH = 1200;
// X/Twitter cards are effectively displayed in a wide aspect ratio; a true 16:9 image avoids
// the platform cropping a square and cutting off important text.
const SHARE_IMAGE_HEIGHT = 675; // 1200x675 = 16:9

const buildShareImageSvg = async (post, db, options = {}) => {
  const variant = String(options.variant || 'share').toLowerCase();
  const isSnapshot = variant === 'snapshot';
  const width = Number.isFinite(Number(options.width))
    ? Math.max(1, Math.round(Number(options.width)))
    : SHARE_IMAGE_WIDTH;
  const height = Number.isFinite(Number(options.height))
    ? Math.max(1, Math.round(Number(options.height)))
    : (isSnapshot ? 1200 : SHARE_IMAGE_HEIGHT);
  const safeHeight = height;
  const safeTop = 0;
  const imageBaseUrl = options.imageBaseUrl || options.frontendOrigin || '';
  const apiBaseUrl = options.apiBaseUrl || '';
  const isFight = post?.type === 'fight' || post?.fight?.teamA || post?.fight?.teamB;
  const siteLabel = 'VersusVerseVault';

  const teamAMembers = splitFightTeamMembers(post?.fight?.teamA);
  const teamBMembers = splitFightTeamMembers(post?.fight?.teamB);
  const teamALabel = normalizeTeamLabel(post?.fight?.teamA);
  const teamBLabel = normalizeTeamLabel(post?.fight?.teamB);
  // For multi-member fights (2v2 etc), show only the primary character per side in the share image.
  // This prevents missing/blank slots and keeps the layout readable in social previews.
  const leftPrimaryName = teamAMembers[0] || '';
  const rightPrimaryName = teamBMembers[0] || '';
  const leftExtraCount = Math.max(0, teamAMembers.length - 1);
  const rightExtraCount = Math.max(0, teamBMembers.length - 1);
  const leftName = isFight ? (leftPrimaryName || teamALabel || 'Team A') : (post?.title || 'Post');
  const rightName = isFight ? (rightPrimaryName || teamBLabel || 'Team B') : '';

  let leftImageUrl = '';
  let rightImageUrl = '';
  let leftFullImageUrl = '';
  let rightFullImageUrl = '';

  if (isFight) {
    const leftCharacter = leftPrimaryName || pickPrimaryTeamName(teamALabel);
    const rightCharacter = rightPrimaryName || pickPrimaryTeamName(teamBLabel);
    const leftImage = await resolveCharacterImageByName(leftCharacter, db);
    const rightImage = await resolveCharacterImageByName(rightCharacter, db);
    leftFullImageUrl = resolveAssetUrl(leftImage, { imageBaseUrl, apiBaseUrl });
    rightFullImageUrl = resolveAssetUrl(rightImage, { imageBaseUrl, apiBaseUrl });
    leftImageUrl = resolveAssetUrl(toCharacterThumbPath(leftImage), { imageBaseUrl, apiBaseUrl });
    rightImageUrl = resolveAssetUrl(toCharacterThumbPath(rightImage), { imageBaseUrl, apiBaseUrl });
  } else {
    const primary = await resolvePostImage(post, db, {
      imageBaseUrl,
      apiBaseUrl
    });
    leftImageUrl = primary;
  }

  const fallbackImageUrl = resolveAssetUrl('/logo512.png', { imageBaseUrl, apiBaseUrl });
  const trustedImageOrigins = [imageBaseUrl, apiBaseUrl].filter(Boolean);
  const leftData =
    (await fetchImageDataUri(leftImageUrl, trustedImageOrigins)) ||
    (leftFullImageUrl
      ? await fetchImageDataUri(leftFullImageUrl, trustedImageOrigins)
      : null) ||
    (await fetchImageDataUri(fallbackImageUrl, trustedImageOrigins)) ||
    buildFallbackSvgDataUri(leftName);
  const rightData =
    isFight
      ? (await fetchImageDataUri(rightImageUrl, trustedImageOrigins)) ||
        (rightFullImageUrl
          ? await fetchImageDataUri(rightFullImageUrl, trustedImageOrigins)
          : null) ||
        (await fetchImageDataUri(fallbackImageUrl, trustedImageOrigins)) ||
        buildFallbackSvgDataUri(rightName)
      : leftData;

  const title = truncateText(
    post?.title ||
      (isFight && teamALabel && teamBLabel ? `${teamALabel} vs ${teamBLabel}` : 'Post'),
    70
  );
  const subtitle = truncateText(post?.content || '', 120);
  const titleLines = splitTextLines(title, 36, 2);
  const subtitleLines = splitTextLines(subtitle, 58, 2);

  if (isFight) {
    const cardWidth = 1080;
    const cardHeight = isSnapshot ? 1080 : 640;
    const cardX = Math.round((width - cardWidth) / 2);
    const cardY = safeTop + Math.round((safeHeight - cardHeight) / 2);

    const panelGap = isSnapshot ? 80 : 120;
    const panelWidth = isSnapshot ? 420 : 320;
    const panelY = cardY + (isSnapshot ? 56 : 36);
    const buttonRowHeight = isSnapshot ? 56 : 44;
    const buttonRowY = cardY + cardHeight - buttonRowHeight - (isSnapshot ? 24 : 14);
    const panelBottomGap = isSnapshot ? 30 : 24;
    const panelHeight = buttonRowY - panelY - panelBottomGap;
    const panelXLeft =
      cardX + Math.round((cardWidth - (panelWidth * 2 + panelGap)) / 2);
    const panelXRight = panelXLeft + panelWidth + panelGap;

    const nameTextTop = panelY + 6;
    const nameFontSize = isSnapshot ? 34 : 28;
    const nameLineHeight = isSnapshot ? 38 : 32;
    const nameStartY = nameTextTop + nameFontSize;

    const frameGap = isSnapshot ? 10 : 8;
    const votesFontSize = isSnapshot ? 28 : 24;
    // SVG text uses a baseline for `y`, so reserve a bit extra space above the baseline.
    const votesHeight = votesFontSize + (isSnapshot ? 12 : 10);
    const bottomPadding = isSnapshot ? 18 : 10;

    const leftNameLines = splitTextLines(normalizeCharacterNameForShare(leftName), 18, 4);
    const rightNameLines = splitTextLines(normalizeCharacterNameForShare(rightName), 18, 4);
    const nameLinesUsed = Math.max(
      1,
      leftNameLines.length || 0,
      rightNameLines.length || 0
    );

    const frameY = nameStartY + nameLineHeight * nameLinesUsed + frameGap;
    const panelBottom = panelY + panelHeight;
    const availableHeight = Math.max(
      220,
      panelBottom - frameY - votesHeight - bottomPadding
    );
    const maxFrameWidth = panelWidth - (isSnapshot ? 70 : 60);
    const frameWidth = Math.min(
      maxFrameWidth,
      Math.round(availableHeight * 9 / 16)
    );
    const frameHeight = Math.round(frameWidth * 16 / 9);
    const frameXLeft =
      panelXLeft + Math.round((panelWidth - frameWidth) / 2);
    const frameXRight =
      panelXRight + Math.round((panelWidth - frameWidth) / 2);
    const votesY = panelBottom - bottomPadding;
    const frameRadius = 20;
    const frameBorderPad = 4;

    const leftNameX = Math.round(panelXLeft + panelWidth / 2);
    const rightNameX = Math.round(panelXRight + panelWidth / 2);

    const teamAVotes = post?.fight?.votes?.teamA || 0;
    const teamBVotes = post?.fight?.votes?.teamB || 0;
    const votesHidden = post?.fight?.voteVisibility === 'final';
    const leftVotesLabel = votesHidden ? 'Votes hidden' : `${teamAVotes} votes`;
    const rightVotesLabel = votesHidden ? 'Votes hidden' : `${teamBVotes} votes`;

    const buttonGap = 24;
    const buttonsX = cardX + 70;
    const buttonsWidth = cardWidth - 140;
    const buttonWidth = Math.round((buttonsWidth - buttonGap * 2) / 3);
    const buttonY = buttonRowY;
    const buttonTextY = buttonY + (isSnapshot ? 36 : 28);

    const badgeHeight = 26;
    const badgeRadius = 13;
    const badgePaddingX = 12;
    const badgeY = panelY + 12;
    const leftBadgeText = leftExtraCount ? `+${leftExtraCount}` : '';
    const rightBadgeText = rightExtraCount ? `+${rightExtraCount}` : '';
    const badgeWidthFor = (text) => (text ? Math.max(36, 18 + text.length * 12) : 0);
    const leftBadgeWidth = badgeWidthFor(leftBadgeText);
    const rightBadgeWidth = badgeWidthFor(rightBadgeText);
    const leftBadgeX = panelXLeft + panelWidth - badgePaddingX - leftBadgeWidth;
    const rightBadgeX = panelXRight + panelWidth - badgePaddingX - rightBadgeWidth;
    const badgeTextY = badgeY + 19;
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0b0f16" />
            <stop offset="100%" stop-color="#0b0f16" />
          </linearGradient>
          <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1b1f27" />
            <stop offset="50%" stop-color="#1e232c" />
            <stop offset="100%" stop-color="#1a1e27" />
          </linearGradient>
          <linearGradient id="panelBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#262a33" />
            <stop offset="100%" stop-color="#1f232b" />
          </linearGradient>
          <linearGradient id="nameBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3d3922" />
            <stop offset="100%" stop-color="#2f2b19" />
          </linearGradient>
          <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#000" flood-opacity="0.45" />
          </filter>
          <filter id="panelShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000" flood-opacity="0.35" />
          </filter>
          <filter id="frameShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000" flood-opacity="0.35" />
          </filter>
          <filter id="buttonShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#000" flood-opacity="0.35" />
          </filter>
          <filter id="nameShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity="0.65" />
          </filter>
          <clipPath id="leftClip">
            <rect x="${frameXLeft}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" rx="${frameRadius}" ry="${frameRadius}" />
          </clipPath>
          <clipPath id="rightClip">
            <rect x="${frameXRight}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" rx="${frameRadius}" ry="${frameRadius}" />
          </clipPath>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bg)" />
        <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="36" ry="36" fill="url(#cardBg)" filter="url(#cardShadow)" />
        <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="36" ry="36" fill="none" stroke="#2c313d" stroke-width="1.5" />

        <rect x="${panelXLeft}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="26" ry="26" fill="url(#panelBg)" stroke="#2f3542" stroke-width="1.5" filter="url(#panelShadow)" />
        <rect x="${panelXRight}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="26" ry="26" fill="url(#panelBg)" stroke="#2f3542" stroke-width="1.5" filter="url(#panelShadow)" />

        ${leftNameLines
           .map(
             (line, index) => `
        <text x="${leftNameX}" y="${nameStartY + index * nameLineHeight}" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="${nameFontSize}" fill="#f8fafc" text-anchor="middle" font-weight="800" filter="url(#nameShadow)" stroke="#0b0f16" stroke-width="4" paint-order="stroke">${escapeHtml(line)}</text>`
           )
           .join('')}
        ${rightNameLines
           .map(
             (line, index) => `
        <text x="${rightNameX}" y="${nameStartY + index * nameLineHeight}" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="${nameFontSize}" fill="#f8fafc" text-anchor="middle" font-weight="800" filter="url(#nameShadow)" stroke="#0b0f16" stroke-width="4" paint-order="stroke">${escapeHtml(line)}</text>`
           )
           .join('')}

        ${leftBadgeText
          ? `
        <rect x="${leftBadgeX}" y="${badgeY}" width="${leftBadgeWidth}" height="${badgeHeight}" rx="${badgeRadius}" ry="${badgeRadius}" fill="#111827" opacity="0.78" stroke="#334155" stroke-width="1" />
        <text x="${leftBadgeX + leftBadgeWidth / 2}" y="${badgeTextY}" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#f8fafc" text-anchor="middle">
          ${escapeHtml(leftBadgeText)}
        </text>`
          : ''}
        ${rightBadgeText
          ? `
        <rect x="${rightBadgeX}" y="${badgeY}" width="${rightBadgeWidth}" height="${badgeHeight}" rx="${badgeRadius}" ry="${badgeRadius}" fill="#111827" opacity="0.78" stroke="#334155" stroke-width="1" />
        <text x="${rightBadgeX + rightBadgeWidth / 2}" y="${badgeTextY}" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#f8fafc" text-anchor="middle">
          ${escapeHtml(rightBadgeText)}
        </text>`
          : ''}

        <rect x="${frameXLeft - frameBorderPad}" y="${frameY - frameBorderPad}" width="${frameWidth + frameBorderPad * 2}" height="${frameHeight + frameBorderPad * 2}" rx="${frameRadius}" ry="${frameRadius}" fill="#2b2f36" stroke="#3b3f46" stroke-width="1.5" filter="url(#frameShadow)" />
        <rect x="${frameXRight - frameBorderPad}" y="${frameY - frameBorderPad}" width="${frameWidth + frameBorderPad * 2}" height="${frameHeight + frameBorderPad * 2}" rx="${frameRadius}" ry="${frameRadius}" fill="#2b2f36" stroke="#3b3f46" stroke-width="1.5" filter="url(#frameShadow)" />
        <image href="${leftData}" x="${frameXLeft}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" preserveAspectRatio="xMidYMin slice" clip-path="url(#leftClip)" />
        <image href="${rightData}" x="${frameXRight}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" preserveAspectRatio="xMidYMin slice" clip-path="url(#rightClip)" />

        <text x="${panelXLeft + panelWidth / 2}" y="${votesY}" font-family="Arial, Helvetica, sans-serif" font-size="${votesFontSize}" fill="#cbd5f5" text-anchor="middle">
          ${escapeHtml(leftVotesLabel)}
        </text>
        <text x="${panelXRight + panelWidth / 2}" y="${votesY}" font-family="Arial, Helvetica, sans-serif" font-size="${votesFontSize}" fill="#cbd5f5" text-anchor="middle">
          ${escapeHtml(rightVotesLabel)}
        </text>

        <rect x="${buttonsX}" y="${buttonY}" width="${buttonWidth}" height="${buttonRowHeight}" rx="16" ry="16" fill="#e74c3c" filter="url(#buttonShadow)" />
        <rect x="${buttonsX + buttonWidth + buttonGap}" y="${buttonY}" width="${buttonWidth}" height="${buttonRowHeight}" rx="16" ry="16" fill="#f39c12" filter="url(#buttonShadow)" />
        <rect x="${buttonsX + (buttonWidth + buttonGap) * 2}" y="${buttonY}" width="${buttonWidth}" height="${buttonRowHeight}" rx="16" ry="16" fill="#3498db" filter="url(#buttonShadow)" />

        <text x="${buttonsX + buttonWidth / 2}" y="${buttonTextY}" font-family="Arial, Helvetica, sans-serif" font-size="${isSnapshot ? 24 : 22}" fill="#f8fafc" text-anchor="middle">
          VOTE!
        </text>
        <text x="${buttonsX + buttonWidth + buttonGap + buttonWidth / 2}" y="${buttonTextY}" font-family="Arial, Helvetica, sans-serif" font-size="${isSnapshot ? 24 : 22}" fill="#f8fafc" text-anchor="middle">
          DRAW
        </text>
        <text x="${buttonsX + (buttonWidth + buttonGap) * 2 + buttonWidth / 2}" y="${buttonTextY}" font-family="Arial, Helvetica, sans-serif" font-size="${isSnapshot ? 24 : 22}" fill="#f8fafc" text-anchor="middle">
          VOTE!
        </text>
      </svg>
    `;
  }

  const cardWidth = 1080;
  const cardHeight = 640;
  const cardX = Math.round((width - cardWidth) / 2);
  const cardY = safeTop + Math.round((safeHeight - cardHeight) / 2);
  const imageX = cardX + 60;
  const imageY = cardY + 170;
  const imageWidth = cardWidth - 120;
  const imageHeight = 360;
  const titleY = cardY + 100;
  const subtitleY = titleY + 28;
  const textX = cardX + 60;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b0f16" />
          <stop offset="100%" stop-color="#0b0f16" />
        </linearGradient>
        <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1b1f27" />
          <stop offset="50%" stop-color="#1e232c" />
          <stop offset="100%" stop-color="#1a1e27" />
        </linearGradient>
        <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#000" flood-opacity="0.45" />
        </filter>
        <clipPath id="singleClip">
          <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="32" ry="32" />
        </clipPath>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="36" ry="36" fill="url(#cardBg)" filter="url(#cardShadow)" />
      <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="36" ry="36" fill="none" stroke="#2c313d" stroke-width="1.5" />
      ${titleLines
        .map(
          (line, index) => `
      <text x="${textX}" y="${titleY + index * 24}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#f8fafc">
        ${escapeHtml(line)}
      </text>`
        )
        .join('')}
      ${subtitleLines
        .map(
          (line, index) => `
      <text x="${textX}" y="${subtitleY + index * 20}" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#94a3b8">
        ${escapeHtml(line)}
      </text>`
        )
        .join('')}
      <image href="${leftData}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#singleClip)" />
    </svg>
  `;
};

const resolvePostImage = async (post, db, baseUrlOrOptions) => {
  if (!post) return '';
  const options =
    typeof baseUrlOrOptions === 'object' && baseUrlOrOptions !== null
      ? baseUrlOrOptions
      : { baseUrl: baseUrlOrOptions };
  const imageBaseUrl = normalizeBaseUrl(options.imageBaseUrl || options.baseUrl);
  const apiBaseUrl = normalizeBaseUrl(
    options.apiBaseUrl || options.baseUrl || imageBaseUrl
  );
  const photos = Array.isArray(post.photos) ? post.photos : [];
  const photoEntry = photos.find(Boolean);
  const photoUrl =
    typeof photoEntry === 'string'
      ? photoEntry
      : photoEntry?.url || photoEntry?.src || photoEntry?.image || '';

  const teams =
    post.fight?.teamA || post.fight?.teamB
      ? [
          ...splitFightTeamMembers(post.fight?.teamA),
          ...splitFightTeamMembers(post.fight?.teamB)
        ].filter(Boolean)
      : [];

  let characterImage = '';
  if (teams.length) {
    const dbCharacters = Array.isArray(db?.characters) ? db.characters : [];
    characterImage = findCharacterImage(teams[0], dbCharacters);
  }

  const fallback = '/logo512.png';
  const raw = photoUrl || normalizeCharacterAssetPath(characterImage) || fallback;
  if (!raw) return '';
  const allowedOrigins = [imageBaseUrl, apiBaseUrl].filter(Boolean);
  if (/^(data:|https?:\/\/)/i.test(raw)) {
    return normalizeSafeImageSource(raw, { allowedOrigins }) || '';
  }

  const normalizedRaw = raw.startsWith('/') ? raw : `/${raw}`;
  const prefersApi =
    normalizedRaw.startsWith('/uploads/') || normalizedRaw.startsWith('/api/uploads/');
  const baseForRelative = prefersApi ? apiBaseUrl : imageBaseUrl;
  const resolved = buildAbsoluteUrl(baseForRelative || apiBaseUrl, normalizedRaw);
  return normalizeSafeImageSource(resolved, { allowedOrigins }) || '';
};

const buildShareMetaTags = async (req, post, db, options = {}) => {
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl || resolveApiOrigin(req));
  const frontendOrigin = normalizeBaseUrl(
    options.frontendOrigin || resolveFrontendOrigin(req)
  );
  const frontendHost = (() => {
    try {
      return new URL(frontendOrigin).host;
    } catch (_error) {
      return '';
    }
  })();
  const url =
    options.url || `${frontendOrigin}/post/${post?.id || post?._id || ''}`;
  const title = normalizeMetaText(
    post?.title ||
      (post?.fight?.teamA && post?.fight?.teamB
        ? `${post.fight.teamA} vs ${post.fight.teamB}`
        : 'Post'),
    80
  );
  const description = normalizeMetaText(
    post?.content ||
      (post?.fight?.teamA && post?.fight?.teamB
        ? `Who wins? ${post.fight.teamA} vs ${post.fight.teamB}`
        : 'Check this post'),
    160
  );
  const resolvedDb = db || { characters: [] };
  const image =
    options.imageUrl ||
    (await resolvePostImage(post, resolvedDb, {
      imageBaseUrl: options.imageBaseUrl || frontendOrigin,
      apiBaseUrl
    }));
  const imageWidth = options.imageWidth || 1200;
  const imageHeight = options.imageHeight || 630;
  const imageType = options.imageType || 'image/png';

  return `
    <title>${escapeHtml(title)}</title>
    <meta property="og:site_name" content="VersusVerseVault" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="${escapeHtml(imageWidth)}" />
    <meta property="og:image:height" content="${escapeHtml(imageHeight)}" />
    <meta property="og:image:type" content="${escapeHtml(imageType)}" />
    <meta name="twitter:card" content="summary_large_image" />
    ${frontendHost ? `<meta name="twitter:domain" content="${escapeHtml(frontendHost)}" />` : ''}
    <meta name="twitter:url" content="${escapeHtml(url)}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(title)}" />
  `;
};

const resolveFrontendOrigin = (req) => {
  const explicit = String(
    process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || ''
  ).trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const host = req.get('host');
  if (!host) {
    return `${req.protocol}://localhost`;
  }
  if (host.startsWith('api.')) {
    return `${req.protocol}://${host.replace(/^api\./, '')}`;
  }
  return `${req.protocol}://${host}`;
};

const resolveApiOrigin = (req) => {
  const explicit = String(process.env.API_ORIGIN || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
};

const buildShareHtml = (meta, redirectUrl, canonicalUrl) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      ${meta || ''}
      <link rel="canonical" href="${escapeHtml(canonicalUrl || redirectUrl)}" />
      <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}" />
    </head>
    <body>
      <p>Redirecting to post...</p>
      <p><a href="${escapeHtml(redirectUrl)}">Open post</a></p>
    </body>
  </html>
`;

// Create HTTP server
const server = http.createServer(app);

const isDev = process.env.NODE_ENV !== 'production';
const authDebugLogsEnabled = process.env.AUTH_DEBUG_LOGS === 'true';
const normalizeOrigin = (value) => {
  if (!value) return null;
  return value.replace(/\/$/, '');
};

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL,
  ...(isDev ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : [])
]
  .filter(Boolean)
  .map(normalizeOrigin);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.includes(normalized);
};

const logAuthDebug = (req, res, label, extra = {}) => {
  if (!authDebugLogsEnabled) return;
  console.log(
    '[AUTH_DEBUG]',
    JSON.stringify({
      label,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res?.statusCode,
      ip: req.ip,
      forwardedFor: req.headers['x-forwarded-for'] || null,
      userAgent: req.get('user-agent') || null,
      rateLimitLimit: res?.getHeader?.('ratelimit-limit') || null,
      rateLimitRemaining: res?.getHeader?.('ratelimit-remaining') || null,
      rateLimitReset: res?.getHeader?.('ratelimit-reset') || null,
      ...extra
    })
  );
};

// Configure Socket.io
const io = new Server(server, {
  maxHttpBufferSize: 256 * 1024,
  cors: {
    origin: (origin, callback) => {
      if (isDev || isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const getActiveChatUsers = async () => {
  const sockets = await io.fetchSockets();
  const usersById = new Map();
  for (const connectedSocket of sockets) {
    const user = connectedSocket.data?.chatUser;
    if (user?.userId) usersById.set(user.userId, user);
  }
  return Array.from(usersById.values());
};

const broadcastActiveChatUsers = async () => {
  try {
    io.emit('active-users', await getActiveChatUsers());
  } catch (error) {
    console.warn('Could not refresh global chat presence:', error?.message || error);
  }
};

const authenticateSocket = async (socket, next) => {
  const authToken = socket.handshake?.auth?.token;
  const authHeader =
    socket.handshake?.headers?.authorization ||
    socket.handshake?.headers?.Authorization;
  const bearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;
  const token =
    getAuthCookieToken(socket.handshake?.headers?.cookie) ||
    authToken ||
    bearerToken;

  if (!token || typeof token !== 'string') {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const tokenUser = payload?.user || payload;
    const userId = tokenUser?.id || tokenUser?._id || payload?.userId;
    if (!userId) {
      return next(new Error('Invalid authentication token'));
    }

    const storedUser = await usersRepo.findById(userId);
    if (!storedUser) {
      return next(new Error('User account was not found'));
    }
    if (
      Number(tokenUser?.tokenVersion || 0) !==
      Number(storedUser.tokenVersion || 0)
    ) {
      return next(new Error('Session is no longer valid'));
    }

    socket.user = {
      id: userId,
      username: storedUser.username,
      role: storedUser.role || 'user',
      profilePicture:
        storedUser.profile?.profilePicture ||
        storedUser.profile?.avatar ||
        storedUser.profilePicture ||
        ''
    };
    return next();
  } catch (_error) {
    return next(new Error('Invalid authentication token'));
  }
};

io.use(authenticateSocket);

io.engine.on('connection_error', (err) => {
  console.error('Engine.IO connection error:', err.code, err.message);
  if (err.context) {
    console.error('Engine.IO context:', err.context);
  }
});

// CCG namespace socket handling
const ccgNamespace = io.of('/ccg');
ccgNamespace.use(authenticateSocket);
const ccgCardsPath = path.join(__dirname, 'ccg', 'data', 'cards.json');
const normalizeCcgRoomId = (roomId) => {
  const normalized = typeof roomId === 'string' ? roomId.trim() : '';
  return /^[a-z0-9_-]{1,100}$/i.test(normalized) ? normalized : null;
};
const getCcgRoomPlayers = async (roomId, excludedSocketId = null) => {
  const roomSockets = await ccgNamespace.in(roomId).fetchSockets();
  return roomSockets
    .filter((roomSocket) => roomSocket.id !== excludedSocketId)
    .map((roomSocket) => roomSocket.data?.ccgPlayer)
    .filter(Boolean)
    .map(({ id, username }) => ({ id, username }));
};
const secureShuffle = (items) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index]
    ];
  }
  return shuffled;
};

ccgNamespace.on('connection', (socket) => {
  socket.on('joinRoom', async ({ roomId } = {}) => {
    const normalizedRoomId = normalizeCcgRoomId(roomId);
    if (!normalizedRoomId) return;
    const joinedCcgRooms = [...socket.rooms].filter(
      (joinedRoomId) => joinedRoomId !== socket.id
    );
    if (!joinedCcgRooms.includes(normalizedRoomId) && joinedCcgRooms.length >= 3) {
      socket.emit('gameError', { message: 'Too many joined rooms.' });
      return;
    }
    const existingPlayers = await getCcgRoomPlayers(normalizedRoomId);
    if (joinedCcgRooms.includes(normalizedRoomId)) {
      socket.emit('playersUpdate', existingPlayers);
      return;
    }
    const alreadyJoined = existingPlayers.some(
      (player) => player.id === socket.user.id
    );
    if (alreadyJoined) {
      socket.emit('gameError', {
        message: 'This account already joined the room.'
      });
      return;
    }
    if (!alreadyJoined && existingPlayers.length >= 2) {
      socket.emit('gameError', { message: 'Room is full.' });
      return;
    }
    socket.data.ccgPlayer = {
      id: socket.user.id,
      username: socket.user.username
    };
    await socket.join(normalizedRoomId);
    const players = await getCcgRoomPlayers(normalizedRoomId);
    ccgNamespace.to(normalizedRoomId).emit('playersUpdate', players);
  });

  socket.on('startGame', async ({ roomId } = {}) => {
    const normalizedRoomId = normalizeCcgRoomId(roomId);
    if (!normalizedRoomId || !socket.rooms.has(normalizedRoomId)) return;
    const players = await getCcgRoomPlayers(normalizedRoomId);
    if (players.length !== 2) {
      socket.emit('gameError', { message: 'Two players are required.' });
      return;
    }
    try {
      const raw = await readFile(ccgCardsPath, 'utf-8');
      const fullDeck = JSON.parse(raw);
      const shuffled = secureShuffle(fullDeck).slice(0, 40);
      ccgNamespace.to(normalizedRoomId).emit('gameStart', { deck: shuffled });
    } catch (err) {
      console.error('Error loading CCG cards.json:', err);
    }
  });

  socket.on('playMove', ({ roomId, move } = {}) => {
    const normalizedRoomId = normalizeCcgRoomId(roomId);
    if (!normalizedRoomId || !socket.rooms.has(normalizedRoomId)) return;
    socket.to(normalizedRoomId).emit('opponentMove', move);
  });

  socket.on('disconnecting', async () => {
    const joinedRooms = [...socket.rooms].filter(
      (roomId) => roomId !== socket.id && normalizeCcgRoomId(roomId)
    );
    socket.data.ccgPlayer = null;
    for (const roomId of joinedRooms) {
      const players = await getCcgRoomPlayers(roomId, socket.id);
      ccgNamespace.to(roomId).emit('playersUpdate', players);
    }
  });
});

// Initialize shared realtime and rate-limit storage before accepting routes.
// In a single-process deployment without REDIS_URL, express-rate-limit safely
// falls back to its local in-memory store.
socketAdapterState = await configureSocketRedisAdapter(io);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: isDev
    ? false
    : {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          formAction: ["'self'"],
          scriptSrc: [
            "'self'",
            'https://accounts.google.com',
            'https://apis.google.com'
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com'
          ],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:', 'https:'],
          connectSrc: [
            "'self'",
            ...allowedOrigins,
            'https://accounts.google.com',
            'https://oauth2.googleapis.com'
          ],
          frameSrc: ["'self'", 'https://accounts.google.com'],
          workerSrc: ["'self'", 'blob:']
        }
      },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: isDev ? false : { policy: 'cross-origin' },
  crossOriginOpenerPolicy: isDev ? false : undefined
}));

// Rate limiting
const apiLimitMax =
  Number(process.env.API_RATE_LIMIT_MAX) ||
  (isDev ? 2000 : 300);
const loginAuthLimitMax =
  Number(process.env.LOGIN_RATE_LIMIT_MAX) ||
  (isDev ? 120 : 15);
const registerAuthLimitMax =
  Number(process.env.REGISTER_RATE_LIMIT_MAX) ||
  (isDev ? 120 : 20);
const passwordAuthLimitMax =
  Number(process.env.AUTH_RATE_LIMIT_MAX) ||
  (isDev ? 120 : 5);
const googleAuthLimitMax =
  Number(process.env.GOOGLE_AUTH_RATE_LIMIT_MAX) ||
  (isDev ? 600 : 30);
const shareRenderLimitMax =
  Number(process.env.SHARE_RENDER_RATE_LIMIT_MAX) ||
  (isDev ? 300 : 30);

const distributedRateLimit = (prefix) => {
  const store = createRedisRateLimitStore(prefix);
  return store ? { store } : {};
};

const limiter = rateLimit({
  ...distributedRateLimit('vvv:rate-limit:api:'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: apiLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  requestPropertyName: 'rateLimitInfo',
  handler: (req, res) => {
    logAuthDebug(req, res, 'rate_limit_global', {
      rateLimit: req.rateLimitInfo || null
    });
    return res.status(429).send('Too many requests from this IP, please try again later.');
  },
  // Auth endpoints have dedicated limiters below.
  skip: (req) => req.path.startsWith('/api/auth/')
});

const loginAuthLimiter = rateLimit({
  ...distributedRateLimit('vvv:rate-limit:login:'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: loginAuthLimitMax,
  message: 'Too many login attempts, please try again later.',
  requestPropertyName: 'rateLimitInfo',
  handler: (req, res) => {
    logAuthDebug(req, res, 'rate_limit_login', {
      rateLimit: req.rateLimitInfo || null
    });
    return res.status(429).send('Too many login attempts, please try again later.');
  },
  skipSuccessfulRequests: true,
});

const registerAuthLimiter = rateLimit({
  ...distributedRateLimit('vvv:rate-limit:register:'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: registerAuthLimitMax,
  message: 'Too many registration attempts, please try again later.',
  requestPropertyName: 'rateLimitInfo',
  handler: (req, res) => {
    logAuthDebug(req, res, 'rate_limit_register', {
      rateLimit: req.rateLimitInfo || null
    });
    return res.status(429).send('Too many registration attempts, please try again later.');
  },
  skipSuccessfulRequests: true
});

const googleAuthLimiter = rateLimit({
  ...distributedRateLimit('vvv:rate-limit:google:'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: googleAuthLimitMax,
  message: 'Too many Google sign-in attempts, please try again later.',
  requestPropertyName: 'rateLimitInfo',
  handler: (req, res) => {
    logAuthDebug(req, res, 'rate_limit_google', {
      rateLimit: req.rateLimitInfo || null
    });
    return res.status(429).send('Too many Google sign-in attempts, please try again later.');
  },
  skipSuccessfulRequests: true
});

const passwordAuthLimiter = rateLimit({
  ...distributedRateLimit('vvv:rate-limit:password:'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: passwordAuthLimitMax,
  message: 'Too many password reset attempts, please try again later.',
  requestPropertyName: 'rateLimitInfo',
  handler: (req, res) => {
    logAuthDebug(req, res, 'rate_limit_password', {
      rateLimit: req.rateLimitInfo || null
    });
    return res.status(429).send('Too many password reset attempts, please try again later.');
  },
  skipSuccessfulRequests: true
});

const shareRenderLimiter = rateLimit({
  ...distributedRateLimit('vvv:rate-limit:share:'),
  windowMs: 60 * 1000,
  max: shareRenderLimitMax,
  message: 'Too many share preview requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);
app.use('/api/auth/login', loginAuthLimiter);
app.use('/api/auth/register', registerAuthLimiter);
app.use('/api/auth/google', googleAuthLimiter);
app.use('/api/auth/forgot-password', passwordAuthLimiter);
app.use('/api/auth/reset-password', passwordAuthLimiter);
app.use('/api/auth/resend-verification', passwordAuthLimiter);
app.use('/api/auth/verify-email', passwordAuthLimiter);
app.use('/api/auth/verify-2fa', passwordAuthLimiter);
app.use(['/share/post', '/api/share/post'], shareRenderLimiter);

// Prevent HTTP Parameter Pollution
app.use(hpp());
app.use(compression());

// Request logging middleware - disabled for cleaner output
// if (process.env.NODE_ENV === 'production') {
//   app.use(morgan('combined'));
// } else {
//   app.use(morgan('dev'));
// }

// CORS
app.use(cors({
  origin: (origin, callback) => {
    if (isDev || isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

app.use((req, res, next) => {
  if (!authDebugLogsEnabled) return next();
  const path = req.originalUrl || req.url;
  const isTracked =
    path.startsWith('/api/auth/') || path.startsWith('/api/profile/me');
  if (!isTracked) return next();

  const start = Date.now();
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      logAuthDebug(req, res, 'tracked_error', {
        durationMs: Date.now() - start
      });
    }
  });
  next();
});

app.use(
  '/uploads',
  express.static(getUploadsRoot(), {
    maxAge: '30d',
    immutable: true,
    etag: true
  })
);

// Character records intentionally use site-relative `/characters/...` URLs.
// Serve the shipped catalog from the API as well as from the React frontend so
// images also work in local/API previews and on deployments sharing one host.
app.use(
  '/characters',
  express.static(path.join(__dirname, '..', 'public', 'characters'), {
    maxAge: '7d',
    etag: true,
    lastModified: true
  })
);

app.get('/placeholder-character.png', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'placeholder-character.png'));
});

app.get('/api/media/characters/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ msg: 'Character id is required.' });
    }

    const media = await getCharacterMediaById(id);
    if (!media || !Buffer.isBuffer(media.data) || media.data.length === 0) {
      return res.status(404).json({ msg: 'Character media not found.' });
    }

    const etag = media.etag ? `"${media.etag}"` : '';
    if (etag && req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.set('Content-Type', media.contentType || 'application/octet-stream');
    res.set('Content-Length', String(media.data.length));
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (etag) {
      res.set('ETag', etag);
    }
    return res.send(media.data);
  } catch (error) {
    console.error('Failed to serve character media:', error?.message || error);
    return res.status(500).json({ msg: 'Server error' });
  }
});

if (isTronRealtimeAuthority()) {
  initTronNamespace(io);
} else {
  console.log('TRON realtime authority is disabled on this API process.');
}

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io; // Make Socket.io available to routes
  next();
});

// Import routes

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/fights', fightRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/divisions', divisionsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/betting', bettingRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/coins', coinsRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/donations', donationsRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/challenges', challengesRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/ccg', ccgRoutes);
app.use('/api/user', userRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/blocks', blocksRoutes);
app.use('/api/swoop', swoopRoutes);
app.use('/api/tron', tronRoutes);

// Share preview endpoint for social cards
const SHARE_IMAGE_RENDER_VERSION = '2026-02-07-share-jpg-8';
const SHARE_IMAGE_CACHE_MAX = 25;
const SHARE_IMAGE_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const shareImageCache = new Map(); // key -> { buffer: Buffer, ts: number }
const shareImageInflight = new Map();

const getShareImageCache = (key) => {
  const entry = shareImageCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > SHARE_IMAGE_CACHE_TTL_MS) {
    shareImageCache.delete(key);
    return null;
  }
  // simple LRU refresh
  shareImageCache.delete(key);
  shareImageCache.set(key, entry);
  return entry.buffer;
};

const setShareImageCache = (key, buffer) => {
  if (!buffer || !Buffer.isBuffer(buffer)) return;
  shareImageCache.set(key, { buffer, ts: Date.now() });
  while (shareImageCache.size > SHARE_IMAGE_CACHE_MAX) {
    const oldestKey = shareImageCache.keys().next().value;
    shareImageCache.delete(oldestKey);
  }
};

const renderShareImageOnce = async (key, renderer) => {
  const existing = shareImageInflight.get(key);
  if (existing) return existing;
  const promise = Promise.resolve()
    .then(renderer)
    .finally(() => shareImageInflight.delete(key));
  shareImageInflight.set(key, promise);
  return promise;
};

const requireShareSnapshotStaff = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'moderator') {
    return res.status(403).json({ msg: 'Staff access required' });
  }
  return next();
};

app.get([
  '/share/post/:id/image',
  '/share/post/:id/image.png',
  '/share/post/:id/image.jpg',
  '/api/share/post/:id/image',
  '/api/share/post/:id/image.png',
  '/api/share/post/:id/image.jpg'
], async (req, res) => {
  try {
    const postId = req.params.id;
    const { post, db } = await loadShareContext(postId);
    if (!post) {
      return res.status(404).send('Post not found.');
    }
    const wantsJpeg = /\.jpg(\?|$)/i.test(String(req.originalUrl || req.url || ''));
    const cacheToken = String(post.updatedAt || post.createdAt || '').slice(0, 100);
    const cacheKey = `${postId}:${cacheToken}:${wantsJpeg ? 'jpg' : 'png'}:${SHARE_IMAGE_RENDER_VERSION}`;
    const cached = getShareImageCache(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', wantsJpeg ? 'image/jpeg' : 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(cached);
    }
    const frontendOrigin = resolveFrontendOrigin(req);
    const apiOrigin = resolveApiOrigin(req);
    const buffer = await renderShareImageOnce(cacheKey, async () => {
      const svg = await buildShareImageSvg(post, db, {
        imageBaseUrl: frontendOrigin,
        apiBaseUrl: apiOrigin,
        frontendOrigin
      });
      const rendered = sharp(Buffer.from(svg), {
        failOn: 'error',
        limitInputPixels: MAX_IMAGE_INPUT_PIXELS
      });
      return wantsJpeg
        ? rendered
            .flatten({ background: '#0b0f16' })
            .jpeg({ quality: 86, mozjpeg: true })
            .toBuffer()
        : rendered.png().toBuffer();
    });
    setShareImageCache(cacheKey, buffer);
    res.setHeader('Content-Type', wantsJpeg ? 'image/jpeg' : 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(buffer);
  } catch (error) {
    console.error('Share image error:', error?.message || error);
    return res.status(500).send('Unable to render share image.');
  }
});

// Downloadable snapshot for moderators/admins (feed-like proportions, not 16:9).
app.get(
  ['/share/post/:id/snapshot.jpg', '/api/share/post/:id/snapshot.jpg'],
  authMiddleware,
  requireShareSnapshotStaff,
  async (req, res) => {
  try {
    const postId = req.params.id;
    const { post, db } = await loadShareContext(postId);
    if (!post) {
      return res.status(404).send('Post not found.');
    }

    const cacheToken = String(post.updatedAt || post.createdAt || '').slice(0, 100);
    const cacheKey = `${postId}:${cacheToken}:snapshot:jpg:${SHARE_IMAGE_RENDER_VERSION}`;
    const cached = getShareImageCache(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (String(req.query.dl || req.query.download || '') === '1') {
        res.setHeader('Content-Disposition', `attachment; filename=\"post-${postId}.jpg\"`);
      }
      return res.send(cached);
    }

    const frontendOrigin = resolveFrontendOrigin(req);
    const apiOrigin = resolveApiOrigin(req);
    const buffer = await renderShareImageOnce(cacheKey, async () => {
      const svg = await buildShareImageSvg(post, db, {
        variant: 'snapshot',
        width: 1200,
        height: 1200,
        imageBaseUrl: frontendOrigin,
        apiBaseUrl: apiOrigin,
        frontendOrigin
      });
      return sharp(Buffer.from(svg), {
        failOn: 'error',
        limitInputPixels: MAX_IMAGE_INPUT_PIXELS
      })
        .flatten({ background: '#0b0f16' })
        .jpeg({ quality: 86, mozjpeg: true })
        .toBuffer();
    });

    setShareImageCache(cacheKey, buffer);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (String(req.query.dl || req.query.download || '') === '1') {
      res.setHeader('Content-Disposition', `attachment; filename=\"post-${postId}.jpg\"`);
    }
    return res.send(buffer);
  } catch (error) {
    console.error('Share snapshot error:', error?.message || error);
    return res.status(500).send('Unable to render snapshot.');
  }
});

app.get(['/share/post/:id', '/api/share/post/:id'], async (req, res) => {
  try {
    const postId = req.params.id;
    const { post, db } = await loadShareContext(postId);
    if (!post) {
      return res.status(404).send('Post not found.');
    }
    const frontendOrigin = resolveFrontendOrigin(req);
    const apiOrigin = resolveApiOrigin(req);
    const versionParam = String(req.query.v || req.query.t || '').trim().slice(0, 100);
    const cacheTokenBase =
      versionParam || post?.updatedAt || post?.createdAt || String(Date.now());
    // Include render version so social platforms treat card meta as changed after deployments.
    const cacheToken = `${cacheTokenBase}-${SHARE_IMAGE_RENDER_VERSION}`;
    const postUrl = `${frontendOrigin}/post/${postId}?v=${encodeURIComponent(cacheToken)}`;
    const redirectUrl = `${frontendOrigin}/post/${postId}`;
    const imageUrl = `${apiOrigin}/share/post/${postId}/image.jpg?v=${encodeURIComponent(cacheToken)}&rv=${encodeURIComponent(SHARE_IMAGE_RENDER_VERSION)}`;
    const meta = await buildShareMetaTags(
      req,
      post,
      db,
      {
        url: postUrl,
        imageUrl,
        imageWidth: SHARE_IMAGE_WIDTH,
        imageHeight: SHARE_IMAGE_HEIGHT,
        imageBaseUrl: frontendOrigin,
        apiBaseUrl: apiOrigin,
        frontendOrigin,
        imageType: 'image/jpeg'
      }
    );
    const html = buildShareHtml(meta, redirectUrl, postUrl);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.send(html);
  } catch (error) {
    console.error('Share meta error:', error?.message || error);
    return res.status(500).send('Unable to render share preview.');
  }
});

// Lightweight health endpoints for uptime checks
app.get(['/healthz', '/api/health'], (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'versusversevault-backend',
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
  }
);

app.get('/readyz', async (req, res) => {
  try {
    const database = await checkDatabaseHealth();
    const redisRequired = Boolean(String(process.env.REDIS_URL || '').trim());
    if (redisRequired && !socketAdapterState.enabled) {
      return res.status(503).json({ ok: false, database, redis: 'unavailable' });
    }
    return res.status(200).json({
      ok: true,
      database: database.mode,
      redis: socketAdapterState.enabled ? 'connected' : 'not-configured'
    });
  } catch (error) {
    console.error('Readiness check failed:', error?.message || error);
    return res.status(503).json({ ok: false });
  }
});

// Division seasons scheduler (auto + manual trigger support)
const DIVISION_SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let divisionSchedulerTimer = null;
const startDivisionScheduler = () => {
  runDivisionSeasonScheduler().catch((error) => {
    console.error('Initial division scheduler error:', error);
  });

  divisionSchedulerTimer = setInterval(() => {
    runDivisionSeasonScheduler().catch((error) => {
      console.error('Recurring division scheduler error:', error);
    });
  }, DIVISION_SCHEDULER_INTERVAL_MS);
};

if (isBackgroundJobsAuthority() && process.env.NODE_ENV !== 'test') {
  startDivisionScheduler();
}

// Basic route or static frontend for production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'build');
  const getIndexHtml = async () => {
    if (cachedIndexHtml) return cachedIndexHtml;
    const html = await readFile(path.join(buildPath, 'index.html'), 'utf-8');
    cachedIndexHtml = html;
    return cachedIndexHtml;
  };

  // Serve static files with proper cache control
  app.use(express.static(buildPath, {
    maxAge: 0, // Don't cache HTML
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Cache JS/CSS files for 1 year (they have hashes in filenames)
      if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } 
      // Don't cache HTML files
      else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // Cache images for 1 week
      else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      }
    }
  }));

  app.get('/post/:id', async (req, res) => {
    try {
      const postId = req.params.id;
      const { post, db } = await loadShareContext(postId);

      const html = await getIndexHtml();
      const frontendOrigin = resolveFrontendOrigin(req);
      const apiOrigin = resolveApiOrigin(req);
      const meta = post
        ? await buildShareMetaTags(req, post, db, {
            url: `${frontendOrigin}/post/${postId}`,
            imageUrl: `${apiOrigin}/share/post/${postId}/image.jpg?v=${encodeURIComponent(
              post?.updatedAt || post?.createdAt || 'v3'
            )}&rv=${encodeURIComponent(SHARE_IMAGE_RENDER_VERSION)}`,
            imageWidth: SHARE_IMAGE_WIDTH,
            imageHeight: SHARE_IMAGE_HEIGHT,
            imageBaseUrl: frontendOrigin,
            apiBaseUrl: apiOrigin,
            frontendOrigin,
            imageType: 'image/jpeg'
          })
        : '';
      const withMeta = meta
        ? html.replace('</head>', `${meta}\n</head>`)
        : html;

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.send(withMeta);
    } catch (error) {
      console.error('Failed to render share meta:', error?.message || error);
      return res.sendFile(path.join(buildPath, 'index.html'));
    }
  });

  app.get('/*splat', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('API is running...');
  });
}

app.use((error, _req, res, _next) => {
  const status =
    error?.type === 'entity.too.large' || error?.code === 'LIMIT_FILE_SIZE'
      ? 413
      : error instanceof SyntaxError && error?.status === 400
        ? 400
        : Number(error?.status || error?.statusCode || 500);
  if (status >= 500) {
    console.error('Unhandled request error:', error);
  }
  if (res.headersSent) return;
  res.status(status).json({
    message:
      status === 413
        ? 'Request payload is too large'
        : status === 400
          ? 'Invalid request'
          : status < 500 && typeof error?.message === 'string'
            ? error.message
            : 'Server error'
  });
});

// Socket.io chat functionality
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  const authUser = socket.user;
  socket.join(`user:${authUser.id}`);
  const socketRateBuckets = new Map();
  const consumeSocketAllowance = (key, limit, windowMs) => {
    const now = Date.now();
    const recent = (socketRateBuckets.get(key) || []).filter(
      (timestamp) => now - timestamp < windowMs
    );
    if (recent.length >= limit) {
      socketRateBuckets.set(key, recent);
      return false;
    }
    recent.push(now);
    socketRateBuckets.set(key, recent);
    return true;
  };

  socket.conn.on('upgradeError', (err) => {
    console.error('Socket upgrade error:', err?.message || err);
  });

  // User joins the global chat
  socket.on('join-chat', async () => {
    const trustedUserId = authUser.id;
    let trustedUsername = authUser.username;
    let trustedProfilePicture = authUser.profilePicture;
    try {
      const storedUser = await usersRepo.findById(trustedUserId);
      if (storedUser) {
        trustedUsername = storedUser.username || trustedUsername;
        trustedProfilePicture =
          storedUser.profile?.profilePicture ||
          storedUser.profile?.avatar ||
          storedUser.profilePicture ||
          trustedProfilePicture;
      }
    } catch (error) {
      console.warn('join-chat: failed to resolve stored user profile:', error?.message || error);
    }

    socket.data.chatUser = {
      userId: trustedUserId,
      username: trustedUsername,
      profilePicture: trustedProfilePicture
    };

    // Notify others that user joined
    socket.broadcast.emit('user-joined', {
      userId: trustedUserId,
      username: trustedUsername,
      profilePicture: trustedProfilePicture
    });

    // Redis-backed adapters make this list include users connected to every API process.
    await broadcastActiveChatUsers();

    // Load recent chat messages
    try {
      const recentMessages = await chatStore.getRecentMessages(50);

      // Make sure avatars reflect the current profile, not the cached chat snapshot.
      let profilePictureByUserId = new Map();
      try {
        const userIds = [...new Set(recentMessages.map((message) => message.userId).filter(Boolean))];
        const users = userIds.length
          ? await usersRepo.findManyBy({ id: { $in: userIds } }, { limit: userIds.length })
          : [];
        profilePictureByUserId = new Map(
          users
            .map((u) => {
              const id = u?.id || u?._id;
              if (!id) return null;
              const pic =
                u?.profile?.profilePicture ||
                u?.profile?.avatar ||
                u?.profilePicture ||
                null;
              return [id, pic];
            })
            .filter(Boolean)
        );
      } catch (error) {
        console.warn('join-chat: failed to resolve user avatars for history:', error?.message || error);
      }

      const formattedMessages = recentMessages.map((msg) => ({
        id: msg.id,
        userId: msg.userId,
        username: msg.username,
        profilePicture: profilePictureByUserId.get(msg.userId) || msg.profilePicture,
        text: msg.text,
        timestamp: msg.timestamp || msg.createdAt,
        reactions: msg.reactions || [],
        isOwn: msg.userId === trustedUserId
      }));

      socket.emit('message-history', formattedMessages);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  });

  // User joins a private conversation
  socket.on('join-conversation', (data) => {
    if (data?.userId && data.userId !== authUser.id) {
      console.warn(`Rejected socket identity mismatch for ${socket.id}`);
      return;
    }
  });

  // Handle sending messages
  socket.on('send-message', async (messageData) => {
    const text =
      typeof messageData?.text === 'string' ? messageData.text.trim() : '';
    if (!text || text.length > 2000 || !socket.data.chatUser) {
      socket.emit('chat-error', { message: 'Invalid chat message.' });
      return;
    }
    if (!consumeSocketAllowance('chat-message', 20, 60 * 1000)) {
      socket.emit('chat-error', {
        message: 'You are sending messages too quickly.'
      });
      return;
    }

    const user = socket.data.chatUser;

    try {
      const newMessage = await chatStore.addMessage({
        userId: user.userId,
        username: user.username,
        profilePicture: user.profilePicture,
        text
      });

      // Trim messages older than 24 hours
      await chatStore.trimMessages();

      const formattedMessage = {
        id: newMessage.id,
        userId: newMessage.userId,
        username: newMessage.username,
        profilePicture: newMessage.profilePicture,
        text: newMessage.text,
        timestamp: newMessage.timestamp || newMessage.createdAt,
        reactions: newMessage.reactions || []
      };

      io.emit('new-message', formattedMessage);
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  });

  // Handle reactions
  socket.on('add-reaction', async (data) => {
    const messageId =
      typeof data?.messageId === 'string' ? data.messageId.trim() : '';
    const emoji = typeof data?.emoji === 'string' ? data.emoji.trim() : '';
    if (
      !messageId ||
      messageId.length > 100 ||
      !emoji ||
      emoji.length > 16 ||
      !socket.data.chatUser
    ) {
      return;
    }
    if (!consumeSocketAllowance('chat-reaction', 60, 60 * 1000)) {
      return;
    }

    const user = socket.data.chatUser;

    try {
      const reactionUpdate = await chatStore.addReaction({
        messageId,
        userId: user.userId,
        username: user.username,
        emoji
      });

      if (reactionUpdate) {
        const payload = reactionUpdate.messageId
          ? reactionUpdate
          : {
              messageId: reactionUpdate.id,
              reactions: reactionUpdate.reactions || []
            };
        io.emit('reaction-added', payload);
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  });

  // User typing indicator
  socket.on('typing', (isTyping) => {
    if (!socket.data.chatUser) return;
    if (!consumeSocketAllowance('typing', 30, 10 * 1000)) return;
    
    const user = socket.data.chatUser;
    socket.broadcast.emit('user-typing', {
      userId: user.userId,
      username: user.username,
      isTyping: Boolean(isTyping)
    });
  });

  // Handle disconnect
  socket.on('disconnect', async (reason) => {
    const user = socket.data.chatUser;
    if (user) {
      socket.data.chatUser = null;
      // Notify others that user left
      socket.broadcast.emit('user-left', {
        userId: user.userId,
        username: user.username
      });
      await broadcastActiveChatUsers();
    }
    console.log('Client disconnected:', socket.id, reason);
  });
});

// Run maintenance once on the designated background authority, not on every
// horizontally scaled API process.
if (isBackgroundJobsAuthority() && process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const { deletedCount = 0 } = await notificationsRepo.removeManyBy({
        type: 'message'
      });
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} message notifications from bell`);
      }
    } catch (err) {
      console.error('Migration error:', err);
    }
  })();
}

// Refuse traffic until production storage is reachable and transaction-safe.
let startupDatabaseWarmupMs = null;
if (process.env.NODE_ENV === 'production') {
  const warmupStartedAt = Date.now();
  await verifyProductionDatabaseCapabilities();
  startupDatabaseWarmupMs = Date.now() - warmupStartedAt;
}

// Start the server
server.listen(PORT, () => {
  const mongoUriPresent = Boolean(
    process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URL ||
      process.env.DATABASE_URL
  );
  const databaseModeRaw =
    process.env.DATABASE || process.env.Database || (mongoUriPresent ? 'mongo' : 'local');
  const databaseMode = databaseModeRaw.toLowerCase();
  const databaseLabel = databaseMode === 'mongo' || databaseMode === 'mongodb'
    ? 'mongo'
    : 'local';
  console.log(`Database mode: ${databaseLabel}`);
  console.log(`Server is running on port ${PORT}`);
  console.log(
    `Socket.IO transport: ${socketAdapterState.enabled ? 'redis' : 'single-process'}`
  );

  if (startupDatabaseWarmupMs !== null) {
    console.log(
      `Mongo startup verification completed in ${startupDatabaseWarmupMs}ms`
    );
  }
});

let shuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down gracefully.`);
  if (divisionSchedulerTimer) {
    clearInterval(divisionSchedulerTimer);
    divisionSchedulerTimer = null;
  }

  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out.');
    process.exit(1);
  }, 15000);
  forceExitTimer.unref();

  try {
    await new Promise((resolve) => io.close(resolve));
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await closeDb();
    await closeSocketRedisAdapter();
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    console.error('Graceful shutdown failed:', error);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
};

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));

export { io };
