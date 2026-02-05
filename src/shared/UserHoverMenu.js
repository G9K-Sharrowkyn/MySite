import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import './UserHoverMenu.css';

const OPEN_DELAY_MS = 1000;
const VIEWPORT_MARGIN_PX = 8;
const MENU_GAP_PX = 10;

const UserHoverMenu = ({ user, children }) => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [menuStyle, setMenuStyle] = useState(null);
  const timerRef = useRef(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);

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

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    const root = rootRef.current;
    const menu = menuRef.current;
    if (!root || !menu || typeof window === 'undefined') {
      return;
    }

    const position = () => {
      const rootRect = root.getBoundingClientRect();
      // Ensure we have a measurable rect (menu renders with fixed positioning).
      const menuRect = menu.getBoundingClientRect();

      const preferRightLeft = rootRect.right + MENU_GAP_PX;
      const fitsRight =
        preferRightLeft + menuRect.width + VIEWPORT_MARGIN_PX <= window.innerWidth;

      const left = fitsRight
        ? preferRightLeft
        : Math.max(
            VIEWPORT_MARGIN_PX,
            rootRect.left - MENU_GAP_PX - menuRect.width
          );

      const centeredTop = rootRect.top + rootRect.height / 2 - menuRect.height / 2;
      const top = Math.min(
        Math.max(VIEWPORT_MARGIN_PX, centeredTop),
        Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - menuRect.height - VIEWPORT_MARGIN_PX)
      );

      setMenuStyle({
        position: 'fixed',
        left,
        top,
        opacity: 1,
        pointerEvents: 'auto'
      });
    };

    // Initial position after first paint, then on viewport changes while open.
    const raf = window.requestAnimationFrame(position);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

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
        <div
          className="user-hover-menu"
          role="menu"
          ref={menuRef}
          style={
            menuStyle || {
              position: 'fixed',
              left: 0,
              top: 0,
              opacity: 0,
              pointerEvents: 'none'
            }
          }
        >
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
