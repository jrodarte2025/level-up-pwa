import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import AppleIcon from '@mui/icons-material/Apple';
import ShopIcon from '@mui/icons-material/Shop';

const APP_STORE_URL = 'https://apps.apple.com/app/id6759622546';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=org.levelupcincinnati.app';
const DISMISS_KEY = 'appStoreBannerDismissed';
const DOWNLOAD_URL = 'https://app.levelupcincinnati.org/download.html';
const QR_CODE_URL = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(DOWNLOAD_URL)}`;

function getPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

export default function AppStoreBanner() {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const platform = getPlatform();

  useEffect(() => {
    // Clear old localStorage dismiss key to reset any existing 14-day cooldowns
    localStorage.removeItem('appStoreBannerDismissed');

    // Check sessionStorage dismissal (per-session only)
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    // Show immediately on all platforms (no delay, no desktop exclusion)
    setVisible(true);
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  };

  const handleDownload = () => {
    const url = platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    window.open(url, '_blank', 'noopener');
  };

  if (!visible) return null;

  const isIOS = platform === 'ios';
  const isDesktop = platform === 'desktop';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1500,
        backgroundColor: theme.palette.mode === 'dark' ? '#1a1a2e' : '#18264E',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        padding: '0.6rem 0.75rem',
        gap: '0.75rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      <IconButton
        onClick={handleDismiss}
        size="small"
        sx={{ color: 'rgba(255,255,255,0.7)', padding: '4px' }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      {!isDesktop && (
        <img
          src="/logo.png"
          alt="Level Up"
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            flexShrink: 0,
          }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {isDesktop ? (
          <div style={{
            fontWeight: 600,
            fontSize: '0.85rem',
            lineHeight: 1.4,
          }}>
            Level Up Cincinnati: switch to our new app for the best experience
          </div>
        ) : (
          <>
            <div style={{
              fontWeight: 600,
              fontSize: '0.85rem',
              lineHeight: 1.2,
            }}>
              Level Up Cincinnati
            </div>
            <div style={{
              fontSize: '0.75rem',
              opacity: 0.8,
              lineHeight: 1.3,
            }}>
              Switch to our new app for the best experience
            </div>
          </>
        )}
      </div>

      {isDesktop ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <img
            src={QR_CODE_URL}
            alt="Scan to download"
            style={{
              width: 80,
              height: 80,
              borderRadius: 6,
              backgroundColor: '#fff',
            }}
          />
          <div style={{
            fontSize: '0.65rem',
            opacity: 0.8,
            marginTop: '0.2rem',
          }}>
            Scan to download
          </div>
        </div>
      ) : (
        <button
          onClick={handleDownload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            backgroundColor: '#F15F5E',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0.5rem 0.85rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {isIOS ? <AppleIcon sx={{ fontSize: 16 }} /> : <ShopIcon sx={{ fontSize: 16 }} />}
          Get App
        </button>
      )}
    </div>
  );
}
