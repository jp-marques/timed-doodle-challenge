import React from 'react';
import { validateNickname } from '../../lib/validation';

export function MenuView({
  nickname,
  nicknameError,
  onNicknameChange,
  onCreate,
  onJoin,
}: {
  nickname: string;
  nicknameError: string;
  onNicknameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const isNicknameInvalid = !!validateNickname(nickname);
  return (
    <div className="panel" style={{ textAlign: 'center' }}>
      <div className="container hero hero-narrow">
        <div>
          <h1>Timed Doodle</h1>
          <div className="subhead">Race the clock to draw prompts with friends.</div>

          {/* Desktop meta row; dot-separated text */}
          <div className="meta-row" aria-hidden>
            Real-time • Multiplayer • No signup
          </div>

          <div style={{ marginTop: 24 }}>
            {/* <div className="label" style={{ marginBottom: 8 }}>Nickname</div> */}
            <input className="input" placeholder="Enter your nickname" value={nickname} onChange={onNicknameChange} maxLength={15} />
            {nicknameError && <div className="error">{nicknameError}</div>}
          </div>

          <div className="cta-row stack" style={{ marginTop: 24 }}>
            <button className="btn primary" onClick={onCreate} disabled={isNicknameInvalid} aria-disabled={isNicknameInvalid}>Create Room</button>
            <div className="alt-action">
              <button className="link-btn" onClick={onJoin}>Have a code? Join room</button>
            </div>
          </div>

          {/* Three-step strip */}
          <div className="steps" style={{ marginTop: 24 }}>
            <div className="step">
              <span className="step-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <span>Create or join</span>
            </div>
            <div className="step">
              <span className="step-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <span>Get a prompt</span>
            </div>
            <div className="step">
              <span className="step-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </span>
              <span>Beat the timer</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



