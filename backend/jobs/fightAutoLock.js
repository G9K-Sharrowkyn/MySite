import cron from 'node-cron';
import divisionService from '../services/divisionService.js';

class FightAutoLockJob {
  constructor() {
    this.isRunning = false;
  }

  // Uruchom cron job - sprawdzaj co 15 minut
  start() {
    console.log('🕐 Starting fight auto-lock cron job...');
    
    // Uruchom co 15 minut
    cron.schedule('*/15 * * * *', async () => {
      if (this.isRunning) {
        console.log('⏳ Fight auto-lock job already running, skipping...');
        return;
      }

      this.isRunning = true;
      
      try {
        console.log('🔍 Checking for expired fights...');
        const lockedCount = await divisionService.autoLockExpiredFights();
        
        if (lockedCount > 0) {
          console.log(`✅ Auto-locked ${lockedCount} expired fights`);
        } else {
          console.log('ℹ️ No expired fights found');
        }
      } catch (error) {
        console.error('❌ Error in fight auto-lock job:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ Fight auto-lock cron job started successfully');
  }

  // Zatrzymaj cron job
  stop() {
    console.log('🛑 Stopping fight auto-lock cron job...');
    cron.destroy();
  }

  // Ręczne uruchomienie sprawdzania
  async runManually() {
    if (this.isRunning) {
      console.log('⏳ Fight auto-lock job already running');
      return { success: false, message: 'Job already running' };
    }

    this.isRunning = true;
    
    try {
      console.log('🔍 Manual check for expired fights...');
      const lockedCount = await divisionService.autoLockExpiredFights();
      
      console.log(`✅ Manually auto-locked ${lockedCount} expired fights`);
      return { 
        success: true, 
        message: `Successfully locked ${lockedCount} expired fights`,
        lockedCount 
      };
    } catch (error) {
      console.error('❌ Error in manual fight auto-lock:', error);
      return { 
        success: false, 
        message: error.message,
        error: error.toString()
      };
    } finally {
      this.isRunning = false;
    }
  }

  // Sprawdź status job'a
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.getNextRunTime()
    };
  }

  // Pobierz czas następnego uruchomienia (przybliżony)
  getNextRunTime() {
    const now = new Date();
    const nextRun = new Date(now);
    
    // Znajdź następny 15-minutowy interwał
    const minutes = now.getMinutes();
    const nextMinutes = Math.ceil(minutes / 15) * 15;
    
    if (nextMinutes >= 60) {
      nextRun.setHours(now.getHours() + 1);
      nextRun.setMinutes(0);
    } else {
      nextRun.setMinutes(nextMinutes);
    }
    
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);
    
    return nextRun;
  }
}

// Eksportuj singleton
const fightAutoLockJob = new FightAutoLockJob();
export default fightAutoLockJob;