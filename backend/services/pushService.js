import webpush from 'web-push';
import { pushSubscriptionsRepo } from '../repositories/index.js';

let configured = false;
let enabled = false;

const ensureConfigured = () => {
  if (configured) {
    return enabled;
  }
  configured = true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || 'mailto:noreply@versusversevault.com';

  if (!publicKey || !privateKey) {
    console.warn('[push] VAPID keys missing; push delivery disabled');
    enabled = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  enabled = true;
  return true;
};

const isInvalidSubscriptionError = (error) =>
  Number(error?.statusCode) === 404 || Number(error?.statusCode) === 410;

export const sendPushToUser = async (userId, payload) => {
  if (!userId || !ensureConfigured()) {
    return;
  }

  const subscriptions = await pushSubscriptionsRepo.filter(
    (entry) => entry.userId === userId && entry.subscription
  );
  if (!subscriptions.length) {
    return;
  }

  const invalidEndpoints = [];
  const serializedPayload = JSON.stringify(payload || {});

  await Promise.all(
    subscriptions.map(async (entry) => {
      try {
        await webpush.sendNotification(entry.subscription, serializedPayload);
      } catch (error) {
        if (isInvalidSubscriptionError(error)) {
          invalidEndpoints.push(entry.subscription?.endpoint);
          return;
        }
        console.error('[push] Delivery failed:', error.message || error);
      }
    })
  );

  if (invalidEndpoints.length > 0) {
    await pushSubscriptionsRepo.updateAll((entries) =>
      entries.filter(
        (entry) =>
          !invalidEndpoints.includes(entry.subscription?.endpoint)
      )
    );
  }
};

export const getVapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';
