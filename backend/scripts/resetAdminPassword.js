import bcrypt from 'bcryptjs';
import { usersRepo } from '../repositories/index.js';

const resetAdminPasswords = async () => {
  try {
    const newPassword = 'Admin123!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await usersRepo.updateAll((users) => {
      // Reset admin password
      const admin = users.find(
        (u) => u.username === 'admin' || u.email === 'admin@site.local'
      );
      if (admin) {
        admin.password = hashedPassword;
        console.log('✅ Admin password reset!');
      }

      // Reset moderator password
      const moderator = users.find(
        (u) => u.username === 'moderator' || u.email === 'moderator@site.local'
      );
      if (moderator) {
        moderator.password = hashedPassword;
        console.log('✅ Moderator password reset!');
      }

      return users;
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 NEW CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📧 ADMIN:');
    console.log('   Email: admin@site.local');
    console.log('   Password: Admin123!');
    console.log('\n📧 MODERATOR:');
    console.log('   Email: moderator@site.local');
    console.log('   Password: Admin123!');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('Error resetting passwords:', error);
  }
};

resetAdminPasswords();
