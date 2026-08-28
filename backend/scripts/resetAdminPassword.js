import bcrypt from 'bcryptjs';
import { usersRepo } from '../repositories/index.js';

const targetEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const newPassword = String(process.env.ADMIN_NEW_PASSWORD || '');

if (!targetEmail) {
  throw new Error('Set ADMIN_EMAIL to the exact account whose password should change.');
}
if (
  newPassword.length < 12 ||
  !/[A-Za-z]/.test(newPassword) ||
  !/\d/.test(newPassword)
) {
  throw new Error(
    'ADMIN_NEW_PASSWORD must contain at least 12 characters, a letter, and a number.'
  );
}

let changed = false;
const hashedPassword = await bcrypt.hash(newPassword, 12);
await usersRepo.updateAll((users) => {
  for (const user of users) {
    if (String(user.email || '').trim().toLowerCase() !== targetEmail) continue;
    if (user.role !== 'admin' && user.role !== 'moderator') {
      throw new Error('The target account is not a staff account.');
    }
    user.password = hashedPassword;
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    user.passwordChangedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    changed = true;
  }
  return users;
});

if (!changed) {
  throw new Error('Staff account was not found.');
}
console.log(`Password changed and existing sessions revoked for ${targetEmail}.`);
