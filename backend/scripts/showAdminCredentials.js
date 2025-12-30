import { readDb } from '../services/jsonDb.js';

const showAdminCredentials = async () => {
  try {
    const db = await readDb();
    
    const admins = db.users.filter(u => u.role === 'admin' || u.role === 'moderator' || u.username === 'admin' || u.username === 'moderator');
    
    if (admins.length === 0) {
      console.log('❌ No admin/moderator users found!');
      return;
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 ADMIN/MODERATOR CREDENTIALS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    admins.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.username.toUpperCase()}`);
      console.log('   📧 Email:', user.email);
      console.log('   👤 Username:', user.username);
      console.log('   🛡️  Role:', user.role);
      console.log('   🆔 ID:', user.id);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ℹ️  Use the EMAIL to log in, not username!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('Error reading database:', error);
  }
};

showAdminCredentials();
