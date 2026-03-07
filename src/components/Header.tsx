import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, Calendar, ChevronDown, Zap, Archive, Clock, RefreshCw } from 'lucide-react';
import { useJiraData } from '../context/JiraDataContext';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { UserProfile } from './UserProfile';

export const Header: React.FC = () => {
  const { refresh, loading, sprintType, setSprintType, lastRefreshAt } = useJiraData();
  const { getBgClass, getHoverBgClass, getRingClass } = useThemeClasses();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formatLastRefresh = () => {
    if (!lastRefreshAt) return 'Henüz yenilenmedi';
    const d = new Date(lastRefreshAt);
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    {
      value: 'active',
      label: 'Aktif Sprint',
      desc: 'Şu an devam eden sprint',
      icon: <Zap size={14} />,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.08)',
      border: 'rgba(34,197,94,0.2)',
    },
    {
      value: 'closed',
      label: 'Son Sprint',
      desc: 'Tamamlanan son sprint',
      icon: <Archive size={14} />,
      color: '#94a3b8',
      bg: 'rgba(148,163,184,0.08)',
      border: 'rgba(148,163,184,0.15)',
    },
  ];

  const selected = options.find(o => o.value === sprintType)!;

  return (
    <>
      <style>{`
        .sprint-pill-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 5px 10px 5px 8px;
          background: white;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
          font-family: inherit;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
          user-select: none;
        }
        .sprint-pill-btn:hover:not(:disabled) {
          border-color: #d1d5db;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .sprint-pill-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sprint-pill-btn.open {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.08);
        }

        .sprint-icon-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sprint-icon-dot.active {
          background: #22c55e;
          box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
          animation: pulse-green 2s infinite;
        }
        .sprint-icon-dot.closed { background: #94a3b8; }

        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.2); }
          50%       { box-shadow: 0 0 0 4px rgba(34,197,94,0.1); }
        }

        .sprint-pill-label {
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          white-space: nowrap;
        }

        .sprint-chevron {
          color: #9ca3af;
          transition: transform 0.22s cubic-bezier(0.4,0,0.2,1);
          flex-shrink: 0;
        }
        .sprint-chevron.rotated { transform: rotate(180deg); }

        /* Dropdown */
        .sprint-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 224px;
          background: white;
          border: 1.5px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06);
          overflow: hidden;
          z-index: 100;
          transform-origin: top left;
          animation: dropIn 0.18s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes dropIn {
          from { opacity: 0; transform: scale(0.93) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        .sprint-dropdown-header {
          padding: 10px 12px 8px;
          border-bottom: 1px solid #f1f5f9;
        }
        .sprint-dropdown-title {
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .sprint-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          cursor: pointer;
          transition: background 0.12s;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
        }
        .sprint-option:hover { background: #f8fafc; }

        .sprint-option-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid;
          transition: transform 0.12s;
        }
        .sprint-option:hover .sprint-option-icon { transform: scale(1.07); }

        .sprint-option-texts { flex: 1; }
        .sprint-option-label {
          font-size: 13px;
          font-weight: 600;
          color: #1f2937;
          line-height: 1;
          margin-bottom: 3px;
        }
        .sprint-option-desc {
          font-size: 11px;
          color: #9ca3af;
          line-height: 1;
        }

        .sprint-option-check {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #6366f1;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          animation: popIn 0.18s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }

        /* Last refresh pill */
        .refresh-time-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px 4px 7px;
          background: #f8fafc;
          border: 1.5px solid #e5e7eb;
          border-radius: 8px;
        }
        .refresh-time-pill-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #22c55e;
          flex-shrink: 0;
          animation: pulse-green 2s infinite;
        }
        .refresh-time-pill-label {
          font-size: 10px;
          font-weight: 500;
          color: #9ca3af;
          letter-spacing: 0.2px;
          white-space: nowrap;
        }
        .refresh-time-pill-value {
          font-size: 11px;
          font-weight: 600;
          color: #4b5563;
          white-space: nowrap;
          letter-spacing: -0.1px;
        }
        .refresh-time-sep {
          width: 1px;
          height: 10px;
          background: #e5e7eb;
          flex-shrink: 0;
        }

        /* Refresh button */
        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          position: relative;
          outline: none;
        }
        .refresh-btn:disabled { cursor: not-allowed; opacity: 0.5; }

        .refresh-btn-inner {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 13px 6px 10px;
          background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
          border-radius: 10px;
          box-shadow: 0 1px 3px rgba(99,102,241,0.3), 0 4px 12px rgba(99,102,241,0.2);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
        }
        .refresh-btn:hover:not(:disabled) .refresh-btn-inner {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(99,102,241,0.35), 0 6px 18px rgba(99,102,241,0.25);
        }
        .refresh-btn:active:not(:disabled) .refresh-btn-inner {
          transform: translateY(0);
          box-shadow: 0 1px 3px rgba(99,102,241,0.3);
        }
        .refresh-btn-text {
          font-size: 12px;
          font-weight: 600;
          color: white;
          letter-spacing: 0.1px;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">

            {/* Left Side - Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`flex items-center justify-center w-8 h-8 ${getBgClass()} rounded-lg`}>
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-semibold text-gray-900">Devbord</h1>
                  <p className="text-xs text-gray-600">Sprint Ve Yazılımcı Takip Sistemi</p>
                </div>
              </div>
            </div>

            {/* Right Side - Controls and User */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">

                {/* === YENİ SPRINT SELECTOR === */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <button
                    className={`sprint-pill-btn${open ? ' open' : ''}`}
                    onClick={() => !loading && setOpen(o => !o)}
                    disabled={loading}
                    title="Sprint türünü seç"
                  >
                    <Calendar size={13} color="#6b7280" />
                    <span className={`sprint-icon-dot ${sprintType}`} />
                    <span className="sprint-pill-label">{selected.label}</span>
                    <ChevronDown
                      size={13}
                      className={`sprint-chevron${open ? ' rotated' : ''}`}
                    />
                  </button>

                  {open && (
                    <div className="sprint-dropdown">
                      <div className="sprint-dropdown-header">
                        <span className="sprint-dropdown-title">
                          <Calendar size={10} />
                          Sprint Görünümü
                        </span>
                      </div>
                      {options.map(opt => (
                        <button
                          key={opt.value}
                          className="sprint-option"
                          onClick={() => {
                            setSprintType(opt.value as 'active' | 'closed');
                            setOpen(false);
                          }}
                        >
                          <div
                            className="sprint-option-icon"
                            style={{
                              background: opt.bg,
                              borderColor: opt.border,
                              color: opt.color,
                            }}
                          >
                            {opt.icon}
                          </div>
                          <div className="sprint-option-texts">
                            <div className="sprint-option-label">{opt.label}</div>
                            <div className="sprint-option-desc">{opt.desc}</div>
                          </div>
                          {sprintType === opt.value && (
                            <div className="sprint-option-check">
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* === / YENİ SPRINT SELECTOR === */}

                {/* Son yenileme bilgisi */}
                <div className="refresh-time-pill">
                  <Clock size={11} color="#9ca3af" />
                  <span className="refresh-time-pill-label">Son güncelleme</span>
                  <div className="refresh-time-sep" />
                  <span className="refresh-time-pill-value">{formatLastRefresh()}</span>
                  {lastRefreshAt && <div className="refresh-time-pill-dot" />}
                </div>

                {/* Refresh Button */}
                <button
                  className="refresh-btn"
                  onClick={refresh}
                  disabled={loading}
                  title="Tüm verileri yenile"
                >
                  <div className="refresh-btn-inner">
                    <RefreshCw size={13} color="white" strokeWidth={2.5} className={loading ? 'spin' : ''} />
                    <span className="refresh-btn-text">{loading ? 'Yenileniyor...' : 'Yenile'}</span>
                  </div>
                </button>
              </div>

              {/* User Profile */}
              <UserProfile />
            </div>

          </div>
        </div>
      </header>
    </>
  );
};