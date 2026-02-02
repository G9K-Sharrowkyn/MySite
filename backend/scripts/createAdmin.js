import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { usersRepo } from '../repositories/index.js';

const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await usersRepo.findOne(
      (u) => u.username === 'admin' || u.role === 'admin'
    );
    if (existingAdmin) {
      console.log('❌ Admin user already exists!');
      console.log('Username:', existingAdmin.username);
      console.log('Role:', existingAdmin.role);
      return;
    }
    
    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    const adminUser = {
      id: uuidv4(),
      username: 'admin',
      email: 'admin@geekfights.com',
      password: hashedPassword,
      role: 'admin',
      profilePicture: '/placeholder-avatar.png',
      description: 'Site Administrator',
      joinedDate: new Date().toISOString(),
      stats: {
        fights: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        noContest: 0,
        winRate: 0,
        points: 0,
        level: 1,
        votes: 0,
        voteAccuracy: 0
      },
      selectedCharacters: [],
      badges: ['admin']
    };
    
    await usersRepo.insert(adminUser);
    
    console.log('✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Username: admin');
    console.log('🔑 Password: admin123');
    console.log('👤 Email: admin@geekfights.com');
    console.log('🛡️  Role: admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Please change the password after first login!');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

createAdminUser();
