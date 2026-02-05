import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import './UserHoverMenu.css';

const OPEN_DELAY_MS = 1000;

const UserHoverMenu = ({ user, children }) => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const timerRef = useRef(null);
  const rootRef = useRef(null);

  const username = (user?.username || '').trim();
  const userId = user?.id;

  const canAct = Boolean(token) && Boolean(userId);

  const stopTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onEnter = () => {
    stopTimer();
    timerRef.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };

  const onLeave = () => {
    stopTimer();
    setOpen(false);
  };

  useEffect(() => stopTimer, []);

  const actions = useMemo(() => {
    return [
      {
        id: 'profile',
        label: 'View profile',
        onClick: () => {
          setOpen(false);
          navigate(`/profile/${encodeURIComponent(username)}`);
        }
      },
      {
        id: 'message',
        label: 'Message',
        onClick: () => {
          setOpen(false);
          navigate(`/messages/${encodeURIComponent(userId)}`);
        }
      },
      {
        id: 'friend',
        label: 'Add friend',
        disabled: !canAct,
        onClick: async () => {
          if (!canAct) return;
          setBusyAction('friend');
          try {
            await axios.post(
              '/api/friends/requests',
              { toUserId: userId },
              { headers: { 'x-auth-token': token } }
            );
          } catch (_error) {
            // UI is intentionally silent here; request status will be visible via notifications.
          } finally {
            setBusyAction(null);
            setOpen(false);
          }
        }
      },
      {
        id: 'block',
        label: 'Block',
        danger: true,
        disabled: !canAct,
        onClick: async () => {
          if (!canAct) return;
          setBusyAction('block');
          try {
            await axios.post(
              `/api/blocks/${encodeURIComponent(userId)}`,
              {},
              { headers: { 'x-auth-token': token } }
            );
          } catch (_error) {
          } finally {
            setBusyAction(null);
            setOpen(false);
          }
        }
      },
      {
        id: 'report',
        label: 'Report',
        danger: true,
        onClick: () => {
          setOpen(false);
          window.dispatchEvent(
            new CustomEvent('open-feedback', { detail: { type: 'user', username } })
          );
        }
      }
    ];
  }, [canAct, navigate, token, userId, username]);

  if (!username) {
    return children;
  }

  return (
    <span
      className="user-hover-root"
      ref={rootRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
      {open && (
        <div className="user-hover-menu" role="menu">
          <div className="user-hover-title">{username}</div>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={[
                'user-hover-item',
                action.danger ? 'danger' : '',
              ].join(' ')}
              onClick={action.onClick}
              disabled={Boolean(action.disabled) || busyAction === action.id}
            >
              {busyAction === action.id ? '...' : action.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
};

export default UserHoverMenu;
