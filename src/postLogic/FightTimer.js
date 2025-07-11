import React, { useState, useEffect } from 'react';
import './FightTimer.css';

const FightTimer = ({ lockTime, status }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false
  });

  useEffect(() => {
    if (status === 'locked' || status === 'completed' || !lockTime) {
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const lockDate = new Date(lockTime).getTime();
      const difference = lockDate - now;

      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          expired: true
        });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [lockTime, status]);

  if (status === 'locked' || status === 'completed') {
    return (
      <div className="fight-timer locked">
        <span className="timer-icon">🔒</span>
        <span className="timer-text">Fight Ended</span>
      </div>
    );
  }

  if (timeLeft.expired) {
    return (
      <div className="fight-timer expired">
        <span className="timer-icon">⏰</span>
        <span className="timer-text">Locking Soon...</span>
      </div>
    );
  }

  const getTimerClass = () => {
    if (timeLeft.days === 0 && timeLeft.hours < 6) {
      return 'urgent';
    } else if (timeLeft.days === 0) {
      return 'warning';
    }
    return 'normal';
  };

  return (
    <div className={`fight-timer ${getTimerClass()}`}>
      <span className="timer-icon">⏱️</span>
      <div className="timer-display">
        {timeLeft.days > 0 && (
          <span className="time-segment">
            <span className="time-value">{timeLeft.days}</span>
            <span className="time-unit">d</span>
          </span>
        )}
        <span className="time-segment">
          <span className="time-value">{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="time-unit">h</span>
        </span>
        <span className="time-segment">
          <span className="time-value">{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="time-unit">m</span>
        </span>
        <span className="time-segment">
          <span className="time-value">{String(timeLeft.seconds).padStart(2, '0')}</span>
          <span className="time-unit">s</span>
        </span>
      </div>
    </div>
  );
};

export default FightTimer; 