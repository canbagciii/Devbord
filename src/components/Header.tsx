import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, RefreshCw, ChevronDown, Zap, Clock } from 'lucide-react';
import { useJiraData } from '../context/JiraDataContext';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { UserProfile } from './UserProfile';

export const Header: React.FC = () => {
  const { refresh, loading, sprintType, setSprintType, lastRefreshAt } = useJiraData();
  const { getBgClass, getRingClass } = useThemeClasses();
  const [scrolled, setScrolled] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const formatLastRefresh = () => {
    if (!lastRefreshAt) return null;
    const d = new Date(lastRefreshAt);
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const refreshTime = formatLastRefresh();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');

        .devbord-header {
          font-family: 'DM Sans', sans-serif;
          position: sticky;
          top: 0;
          z-index: 40;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .devbord-header.scrolled {
          padding: 0 0 6px;
        }

        .header-inner {
          background: rgba(10, 10, 20, 0.92);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          transition: box-shadow 0.3s ease, background 0.3s ease;
        }

        .devbord-header.scrolled .header-inner {
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2);
          background: rgba(8, 8, 18, 0.97);
        }

        /* Logo pill */
        .logo-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 5px 12px 5px 6px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          transition: background 0.2s, border-color 0.2s;
          cursor: default;
        }
        .logo-pill:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.14);
        }

        .logo-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 0 1px rgba(99,102,241,0.4), 0 4px 12px rgba(99,102,241,0.35);
          flex-shrink: 0;
        }

        .logo-text-title {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 15px;
          color: #f1f5f9;
          letter-spacing: -0.3px;
          line-height: 1;
        }

        .logo-text-sub {
          font-size: 10px;
          color: rgba(148,163,184,0.7);
          letter-spacing: 0.3px;
          margin-top: 2px;
          line-height: 1;
        }

        /* Live badge */
        .live-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.25);
          border-radius: 20px;
        }
        .live-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }
        .live-text {
          font-size: 10px;
          font-weight: 600;
          color: #22c55e;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        /* Divider */
        .v-divider {
          width: 1px;
          height: 22px;
          background: rgba(255,255,255,0.1);
          flex-shrink: 0;
        }

        /* Sprint selector */
        .sprint-selector {
          position: relative;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .sprint-label {
          font-size: 11px;
          color: rgba(148,163,184,0.6);
          font-weight: 500;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }
        .sprint-select-wrapper {
          position: relative;
        }
        .sprint-select {
          appearance: none;
          -webkit-appearance: none;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 9px;
          color: #e2e8f0;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 500;
          padding: 6px 30px 6px 10px;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .sprint-select:hover:not(:disabled) {
          background: rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.18);
        }
        .sprint-select:focus {
          border-color: rgba(99,102,241,0.6);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
        }
        .sprint-select:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .sprint-select option {
          background: #1e1e2e;
          color: #e2e8f0;
        }
        .select-chevron {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: rgba(148,163,184,0.5);
        }

        /* Last refresh */
        .refresh-time {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
        }
        .refresh-time-text {
          font-size: 10.5px;
          color: rgba(148,163,184,0.55);
          letter-spacing: 0.1px;
          white-space: nowrap;
        }

        /* Refresh button */
        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border: none;
          color: white;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.2px;
          box-shadow: 0 2px 12px rgba(99,102,241,0.35), 0 1px 3px rgba(0,0,0,0.2);
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          white-space: nowrap;
        }
        .refresh-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 4px 18px rgba(99,102,241,0.45), 0 2px 6px rgba(0,0,0,0.25);
        }
        .refresh-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin { animation: spin-slow 0.9s linear infinite; }

        /* Loading shimmer on top */
        .loading-bar {
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, #6366f1 40%, #a78bfa 60%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 1.2s ease infinite;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* Container */
        .header-container {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 20px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .sprint-label { display: none; }
          .refresh-time { display: none; }
          .logo-text-sub { display: none; }
        }
      `}</style>

      <header className={`devbord-header${scrolled ? ' scrolled' : ''}`}>
        {loading && <div className="loading-bar" />}
        <div className="header-inner">
          <div className="header-container">

            {/* LEFT */}
            <div className="header-left">
              <div className="logo-pill">
                <div className="logo-icon-wrap">
                  <BarChart3 size={16} color="white" strokeWidth={2.2} />
                </div>
                <div>
                  <div className="logo-text-title">Devbord</div>
                  <div className="logo-text-sub">Sprint & Yazılımcı Takip</div>
                </div>
              </div>

              {!loading && (
                <div className="live-badge">
                  <div className="live-dot" />
                  <span className="live-text">Canlı</span>
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div className="header-right">

              {/* Sprint Selector */}
              <div className="sprint-selector">
                <Calendar size={13} color="rgba(148,163,184,0.55)" />
                <span className="sprint-label">Sprint</span>
                <div className="sprint-select-wrapper">
                  <select
                    value={sprintType}
                    onChange={(e) => setSprintType(e.target.value as 'active' | 'closed')}
                    className="sprint-select"
                    disabled={loading}
                  >
                    <option value="active">Aktif Sprintler</option>
                    <option value="closed">Son Kapatılan</option>
                  </select>
                  <ChevronDown size={12} className="select-chevron" />
                </div>
              </div>

              <div className="v-divider" />

              {/* Last refresh time */}
              {refreshTime && (
                <div className="refresh-time">
                  <Clock size={11} color="rgba(148,163,184,0.45)" />
                  <span className="refresh-time-text">{refreshTime}</span>
                </div>
              )}

              {/* Refresh Button */}
              <button
                onClick={refresh}
                disabled={loading}
                className="refresh-btn"
                title="Tüm verileri yenile"
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} strokeWidth={2.5} />
                <span>{loading ? 'Yenileniyor' : 'Yenile'}</span>
              </button>

              <div className="v-divider" />

              {/* User Profile */}
              <UserProfile />
            </div>

          </div>
        </div>
      </header>
    </>
  );
};