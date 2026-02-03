import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './OnboardingChecklist.css';

const DEFAULT_AVATAR = '/logo192.png';

const OnboardingChecklist = () => {
  const [profile, setProfile] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('onboarding-dismissed') === '1';
    if (dismissed) {
      setHidden(true);
      return;
    }

    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const response = await axios.get('/api/profile/me', {
          headers: { 'x-auth-token': token }
        });
        setProfile(response.data || null);
      } catch (error) {
        console.error('Onboarding profile fetch failed:', error);
      }
    };
    load();
  }, []);

  const tasks = useMemo(() => {
    if (!profile) return [];
    const avatar = String(profile.profilePicture || '').trim();
    const description = String(profile.description || '').trim();
    const postsCreated = profile.activity?.postsCreated || 0;
    const commentsPosted = profile.activity?.commentsPosted || 0;

    return [
      {
        id: 'avatar',
        title: 'Add profile photo',
        done: Boolean(avatar && avatar !== DEFAULT_AVATAR),
        action: <Link to="/profile/me">Open profile</Link>
      },
      {
        id: 'bio',
        title: 'Add profile description',
        done: description.length > 0,
        action: <Link to="/profile/me">Edit profile</Link>
      },
      {
        id: 'post',
        title: 'Create your first post',
        done: postsCreated > 0,
        action: <a href="#create-post">Create now</a>
      },
      {
        id: 'comment',
        title: 'Write first comment',
        done: commentsPosted > 0,
        action: <a href="#feed-list">Go to feed</a>
      }
    ];
  }, [profile]);

  const doneCount = tasks.filter((task) => task.done).length;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  if (hidden || !tasks.length || allDone) return null;

  return (
    <section className="onboarding-box">
      <div className="onboarding-header">
        <h3>Quick start checklist</h3>
        <button
          type="button"
          className="onboarding-close"
          onClick={() => {
            setHidden(true);
            localStorage.setItem('onboarding-dismissed', '1');
          }}
        >
          Hide
        </button>
      </div>
      <p className="onboarding-progress">
        Completed: {doneCount}/{tasks.length}
      </p>
      <div className="onboarding-list">
        {tasks.map((task) => (
          <div key={task.id} className={`onboarding-item ${task.done ? 'done' : ''}`}>
            <span className="status">{task.done ? '✓' : '•'}</span>
            <span className="title">{task.title}</span>
            {!task.done && <span className="action">{task.action}</span>}
          </div>
        ))}
      </div>
    </section>
  );
};

export default OnboardingChecklist;

