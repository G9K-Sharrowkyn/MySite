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
import morgan from 'morgan';
import hpp from 'hpp';
import http from 'http';
import axios from 'axios';
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
import './jobs/tournamentScheduler.js'; // Initialize tournament scheduler
import { notificationsRepo } from './repositories/index.js';
import { usersRepo } from './repositories/index.js';
import { readDb } from './repositories/index.js';
import { readDb as warmupReadDb } from './services/jsonDb.js';
import { getMongoConfig } from './services/mongoDb.js';
import { getCharacterMediaById } from './services/characterMedia.js';
import { initTronNamespace } from './realtime/tronArena.js';

const chatStore = {
  getRecentMessages: getLocalRecentMessages,
  addMessage: addLocalMessage,
  addReaction: addLocalReaction,
  trimMessages: trimLocalMessages
};
const app = express();
const PORT = process.env.PORT || 5000;
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
  if (/^data:/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  const base =
    normalized.startsWith('/uploads/') ||
    normalized.startsWith('/api/uploads/') ||
    normalized.startsWith('/api/media/')
      ? normalizeBaseUrl(options.apiBaseUrl)
      : normalizeBaseUrl(options.imageBaseUrl || options.baseUrl);
  if (!base) return normalized;
  return buildAbsoluteUrl(base, normalized);
};

const guessImageType = (url, contentType) => {
  if (contentType && contentType.startsWith('image/')) return contentType;
  const lower = String(url || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
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

const fetchImageDataUri = async (url) => {
  if (!url) return null;
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000,
      validateStatus: (status) => status >= 200 && status < 300
    });
    const contentType = response.headers?.['content-type'] || '';
    const buffer = Buffer.from(response.data);
    if (!buffer.length) return null;
    const mime = guessImageType(url, contentType);

    // Social preview image is rendered by converting an SVG to PNG via sharp. Some SVG rasterizers
    // are unreliable with embedded WebP/AVIF. Only normalize those formats to PNG to keep rendering fast.
    if (mime === 'image/webp' || mime === 'image/avif') {
      try {
        const png = await sharp(buffer).png().toBuffer();
        if (png?.length) {
          return `data:image/png;base64,${png.toString('base64')}`;
        }
      } catch (_error) {
        // Fall back to original bytes below.
      }
    }

    return `data:${mime};base64,${buffer.toString('base64')}`;
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
  const leftData =
    (await fetchImageDataUri(leftImageUrl)) ||
    (leftFullImageUrl ? await fetchImageDataUri(leftFullImageUrl) : null) ||
    (await fetchImageDataUri(fallbackImageUrl)) ||
    buildFallbackSvgDataUri(leftName);
  const rightData =
    isFight
      ? (await fetchImageDataUri(rightImageUrl)) ||
        (rightFullImageUrl ? await fetchImageDataUri(rightFullImageUrl) : null) ||
        (await fetchImageDataUri(fallbackImageUrl)) ||
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
  if (/^data:/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return encodeURI(raw);

  const normalizedRaw = raw.startsWith('/') ? raw : `/${raw}`;
  const prefersApi =
    normalizedRaw.startsWith('/uploads/') || normalizedRaw.startsWith('/api/uploads/');
  const baseForRelative = prefersApi ? apiBaseUrl : imageBaseUrl;
  const resolved = buildAbsoluteUrl(baseForRelative || apiBaseUrl, normalizedRaw);
  return encodeURI(resolved);
};

const buildShareMetaTags = async (req, post, db, options = {}) => {
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl || `${req.protocol}://${req.get('host')}`);
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
  const resolvedDb = db || (await readDb().catch(() => null));
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
  const explicit = String(process.env.FRONTEND_ORIGIN || '').trim();
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

const buildShareHtml = (meta, redirectUrl, canonicalUrl) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      ${meta || ''}
      <link rel="canonical" href="${escapeHtml(canonicalUrl || redirectUrl)}" />
    </head>
    <body>
      <p>Redirecting to post...</p>
      <p><a href="${escapeHtml(redirectUrl)}">Open post</a></p>
      <script>
        window.location.replace(${JSON.stringify(redirectUrl)});
      </script>
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
  'http://localhost:3000',
  'http://127.0.0.1:3000'
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
  maxHttpBufferSize: 5e6,
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

// Socket.io maps for tracking users
const activeUsers = new Map(); // Track active users in global chat
const userSocketMap = new Map(); // Map userId to socketId for private messages

io.engine.on('connection_error', (err) => {
  console.error('Engine.IO connection error:', err.code, err.message);
  if (err.context) {
    console.error('Engine.IO context:', err.context);
  }
});

// CCG namespace socket handling
const ccgNamespace = io.of('/ccg');
const ccgRoomPlayers = {};
const ccgCardsPath = path.join(__dirname, 'ccg', 'data', 'cards.json');

ccgNamespace.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, user }) => {
    socket.join(roomId);
    if (!ccgRoomPlayers[roomId]) {
      ccgRoomPlayers[roomId] = {};
    }
    ccgRoomPlayers[roomId][socket.id] = { id: user.id, username: user.username };
    const players = Object.values(ccgRoomPlayers[roomId]);
    ccgNamespace.to(roomId).emit('playersUpdate', players);
  });

  socket.on('startGame', async ({ roomId }) => {
    try {
      const raw = await readFile(ccgCardsPath, 'utf-8');
      const fullDeck = JSON.parse(raw);
      const shuffled = fullDeck.sort(() => 0.5 - Math.random()).slice(0, 40);
      ccgNamespace.to(roomId).emit('gameStart', { deck: shuffled });
    } catch (err) {
      console.error('Error loading CCG cards.json:', err);
    }
  });

  socket.on('playMove', ({ roomId, move }) => {
    socket.to(roomId).emit('opponentMove', move);
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (ccgRoomPlayers[roomId]) {
        delete ccgRoomPlayers[roomId][socket.id];
        ccgNamespace.to(roomId).emit(
          'playersUpdate',
          Object.values(ccgRoomPlayers[roomId])
        );
      }
    }
  });
});

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, enable in production
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: isDev ? false : { policy: 'cross-origin' },
  crossOriginOpenerPolicy: isDev ? false : undefined
}));

// Rate limiting
const apiLimitMax =
  Number(process.env.API_RATE_LIMIT_MAX) ||
  (isDev ? 2000 : 5000);
const loginAuthLimitMax =
  Number(process.env.LOGIN_RATE_LIMIT_MAX) ||
  (isDev ? 120 : 30);
const registerAuthLimitMax =
  Number(process.env.REGISTER_RATE_LIMIT_MAX) ||
  (isDev ? 120 : 60);
const passwordAuthLimitMax =
  Number(process.env.AUTH_RATE_LIMIT_MAX) ||
  (isDev ? 120 : 30);
const googleAuthLimitMax =
  Number(process.env.GOOGLE_AUTH_RATE_LIMIT_MAX) ||
  (isDev ? 600 : 400);

const limiter = rateLimit({
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

app.use('/api/', limiter);
app.use('/api/auth/login', loginAuthLimiter);
app.use('/api/auth/register', registerAuthLimiter);
app.use('/api/auth/google', googleAuthLimiter);
app.use('/api/auth/forgot-password', passwordAuthLimiter);
app.use('/api/auth/reset-password', passwordAuthLimiter);

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
app.use(express.json({ limit: '50mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Increase URL-encoded payload limit

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
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '30d',
    immutable: true,
    etag: true
  })
);

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

initTronNamespace(io);

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io; // Make Socket.io available to routes
  req.userSocketMap = userSocketMap; // Make userSocketMap available to routes
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

// Share preview endpoint for social cards
const SHARE_IMAGE_RENDER_VERSION = '2026-02-07-share-jpg-8';
const SHARE_IMAGE_CACHE_MAX = 25;
const SHARE_IMAGE_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const shareImageCache = new Map(); // key -> { buffer: Buffer, ts: number }

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
app.get([
  '/share/post/:id/image',
  '/share/post/:id/image.png',
  '/share/post/:id/image.jpg',
  '/api/share/post/:id/image',
  '/api/share/post/:id/image.png',
  '/api/share/post/:id/image.jpg'
], async (req, res) => {
  try {
    const db = await readDb();
    const postId = req.params.id;
    const post =
      (db.posts || []).find((entry) => (entry.id || entry._id) === postId) ||
      null;
    const wantsJpeg = /\.jpg(\?|$)/i.test(String(req.originalUrl || req.url || ''));
    const cacheToken = String(req.query.v || req.query.t || post?.updatedAt || post?.createdAt || '').trim();
    const cacheKey = `${postId}:${cacheToken}:${wantsJpeg ? 'jpg' : 'png'}:${SHARE_IMAGE_RENDER_VERSION}`;
    const cached = getShareImageCache(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', wantsJpeg ? 'image/jpeg' : 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(cached);
    }
    const frontendOrigin = resolveFrontendOrigin(req);
    const apiOrigin = `${req.protocol}://${req.get('host')}`;
    const svg = await buildShareImageSvg(
      post || { id: postId, title: 'Post', content: '' },
      db,
      {
        imageBaseUrl: frontendOrigin,
        apiBaseUrl: apiOrigin,
        frontendOrigin
      }
    );
    const rendered = sharp(Buffer.from(svg));
    const buffer = wantsJpeg
      ? await rendered.flatten({ background: '#0b0f16' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
      : await rendered.png().toBuffer();
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
app.get(['/share/post/:id/snapshot.jpg', '/api/share/post/:id/snapshot.jpg'], async (req, res) => {
  try {
    const db = await readDb();
    const postId = req.params.id;
    const post =
      (db.posts || []).find((entry) => (entry.id || entry._id) === postId) ||
      null;

    const cacheToken = String(req.query.v || req.query.t || post?.updatedAt || post?.createdAt || '').trim();
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
    const apiOrigin = `${req.protocol}://${req.get('host')}`;
    const svg = await buildShareImageSvg(
      post || { id: postId, title: 'Post', content: '' },
      db,
      {
        variant: 'snapshot',
        width: 1200,
        height: 1200,
        imageBaseUrl: frontendOrigin,
        apiBaseUrl: apiOrigin,
        frontendOrigin
      }
    );

    const buffer = await sharp(Buffer.from(svg))
      .flatten({ background: '#0b0f16' })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();

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
    const db = await readDb();
    const postId = req.params.id;
    const post =
      (db.posts || []).find((entry) => (entry.id || entry._id) === postId) ||
      null;
    const frontendOrigin = resolveFrontendOrigin(req);
    const apiOrigin = `${req.protocol}://${req.get('host')}`;
    const versionParam = String(req.query.v || req.query.t || '').trim();
    const cacheTokenBase =
      versionParam || post?.updatedAt || post?.createdAt || String(Date.now());
    // Include render version so social platforms treat card meta as changed after deployments.
    const cacheToken = `${cacheTokenBase}-${SHARE_IMAGE_RENDER_VERSION}`;
    const postUrl = `${frontendOrigin}/post/${postId}?v=${encodeURIComponent(cacheToken)}`;
    const redirectUrl = `${frontendOrigin}/post/${postId}`;
    const imageUrl = `${apiOrigin}/share/post/${postId}/image.jpg?v=${encodeURIComponent(cacheToken)}&rv=${encodeURIComponent(SHARE_IMAGE_RENDER_VERSION)}`;
    const meta = await buildShareMetaTags(
      req,
      post || { id: postId, title: 'Post', content: '' },
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
  const mongoUriPresent = Boolean(
    process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      process.env.MONGO_URL ||
      process.env.DATABASE_URL
  );
  const explicitDatabaseMode = String(process.env.DATABASE || process.env.Database || '').trim();
  const databaseModeRaw = explicitDatabaseMode || (mongoUriPresent ? 'mongo' : 'local');
  const databaseMode = databaseModeRaw.toLowerCase();
  const databaseLabel =
    databaseMode === 'mongo' || databaseMode === 'mongodb' ? 'mongo' : 'local';

  const mongoConfig = mongoUriPresent ? getMongoConfig() : null;
  const googleAuthConfigured = Boolean(
    String(
      process.env.GOOGLE_CLIENT_ID ||
        process.env.GOOGLE_CLIENT_IDS ||
        process.env.REACT_APP_GOOGLE_CLIENT_ID ||
        ''
    ).trim()
  );

  res.status(200).json({
    ok: true,
    service: 'versusversevault-backend',
    env: process.env.NODE_ENV || 'development',
    database: databaseLabel,
    mongoUriPresent,
    mongoDbName: mongoConfig?.dbName || null,
    mongoDbNameSource: mongoConfig?.dbNameSource || null,
    mongoHost: mongoConfig?.host || null,
    googleAuthConfigured,
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Division seasons scheduler (auto + manual trigger support)
const DIVISION_SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const startDivisionScheduler = () => {
  runDivisionSeasonScheduler().catch((error) => {
    console.error('Initial division scheduler error:', error);
  });

  setInterval(() => {
    runDivisionSeasonScheduler().catch((error) => {
      console.error('Recurring division scheduler error:', error);
    });
  }, DIVISION_SCHEDULER_INTERVAL_MS);
};

startDivisionScheduler();

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
      const db = await readDb();
      const postId = req.params.id;
      const post = (db.posts || []).find(
        (entry) => (entry.id || entry._id) === postId
      );

      const html = await getIndexHtml();
      const frontendOrigin = resolveFrontendOrigin(req);
      const apiOrigin = `${req.protocol}://${req.get('host')}`;
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

// Socket.io chat functionality
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  const resolveSocketAuthUser = () => {
    const token = socket.handshake?.auth?.token;
    if (!token || typeof token !== 'string') return null;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const userId = payload?.user?.id || payload?.userId || payload?.id;
      if (!userId) return null;
      return { id: userId, role: payload?.user?.role || payload?.role || 'user' };
    } catch (_error) {
      return null;
    }
  };
  const authUser = resolveSocketAuthUser();

  socket.conn.on('upgradeError', (err) => {
    console.error('Socket upgrade error:', err?.message || err);
  });

  // User joins the global chat
  socket.on('join-chat', async (userData) => {
    if (!userData || !userData.userId) {
      console.error('Invalid user data for join-chat');
      return;
    }

    // Prefer server-trusted identity/profile data when available.
    const trustedUserId = authUser?.id || userData.userId;
    let trustedUsername = userData.username;
    let trustedProfilePicture = userData.profilePicture;
    try {
      // NOTE: repositories default to local JSON snapshots unless a db context is provided.
      // On production we run on MongoDB, so read the active DB first.
      const db = await readDb();
      const storedUser =
        (db?.users || []).find((entry) => (entry?.id || entry?._id) === trustedUserId) ||
        (await usersRepo.findOne((entry) => (entry.id || entry._id) === trustedUserId, { db }));
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

    // Store user info
    activeUsers.set(socket.id, {
      userId: trustedUserId,
      username: trustedUsername,
      profilePicture: trustedProfilePicture
    });

    // Notify others that user joined
    socket.broadcast.emit('user-joined', {
      userId: trustedUserId,
      username: trustedUsername,
      profilePicture: trustedProfilePicture
    });

    // Send active users list
    socket.emit('active-users', Array.from(activeUsers.values()));

    // Load recent chat messages
    try {
      const recentMessages = await chatStore.getRecentMessages(50);

      // Make sure avatars reflect the current profile, not the cached chat snapshot.
      let profilePictureByUserId = new Map();
      try {
        const db = await readDb();
        const users = Array.isArray(db?.users) ? db.users : [];
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
    console.log('Received join-conversation event:', data);
    if (!data || !data.userId) {
      console.error('Invalid data for join-conversation:', data);
      return;
    }
    
    // Map userId to socketId
    userSocketMap.set(data.userId, socket.id);
    console.log(`User ${data.userId} joined with socket ${socket.id}`);
    console.log('Current userSocketMap:', Array.from(userSocketMap.entries()));
  });

  // Handle sending messages
  socket.on('send-message', async (messageData) => {
    if (!messageData || !messageData.text || !activeUsers.has(socket.id)) {
      console.error('Invalid message data');
      return;
    }

    const user = activeUsers.get(socket.id);

    try {
      const newMessage = await chatStore.addMessage({
        userId: user.userId,
        username: user.username,
        profilePicture: user.profilePicture,
        text: messageData.text
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
    if (!data || !data.messageId || !data.emoji || !activeUsers.has(socket.id)) {
      return;
    }

    const user = activeUsers.get(socket.id);

    try {
      const reactionUpdate = await chatStore.addReaction({
        messageId: data.messageId,
        userId: user.userId,
        username: user.username,
        emoji: data.emoji
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
    if (!activeUsers.has(socket.id)) return;
    
    const user = activeUsers.get(socket.id);
    socket.broadcast.emit('user-typing', {
      userId: user.userId,
      username: user.username,
      isTyping
    });
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      activeUsers.delete(socket.id);
      
      // Remove from userSocketMap
      userSocketMap.forEach((socketId, userId) => {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
        }
      });
      
      // Notify others that user left
      socket.broadcast.emit('user-left', {
        userId: user.userId,
        username: user.username
      });
    }
    console.log('Client disconnected:', socket.id, reason);
  });
});

// One-time migration: Remove message-type notifications (they should only be on chat icon)
(async () => {
  try {
    const notifications = await notificationsRepo.getAll();
    const messageNotifications =
      notifications?.filter((n) => n.type === 'message') || [];
    if (messageNotifications.length > 0) {
      await notificationsRepo.updateAll((items) =>
        items.filter((n) => n.type !== 'message')
      );
      console.log(`Cleaned up ${messageNotifications.length} message notifications from bell`);
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
})();

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

  // Prime Mongo cache once on startup to reduce first-request latency in production.
  if (databaseLabel === 'mongo') {
    const warmupStartedAt = Date.now();
    warmupReadDb()
      .then(() => {
        console.log(`Mongo cache warmup completed in ${Date.now() - warmupStartedAt}ms`);
      })
      .catch((error) => {
        console.error('Mongo cache warmup failed:', error?.message || error);
      });
  }
});

export { io };
