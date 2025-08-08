import React from 'react';

export function MenuView({
  nickname,
  nicknameError,
  onNicknameChange,
  onContinue,
}: {
  nickname: string;
  nicknameError: string;
  onNicknameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onContinue: () => void;
}) {
  return (
    <div className="panel small" style={{ textAlign: 'center' }}>
      <h1>Timed Doodle</h1>
      <div style={{ marginBottom: 8 }} className="label">
        Nickname
      </div>
      <input className="input" placeholder="Enter your nickname" value={nickname} onChange={onNicknameChange} maxLength={15} />
      {nicknameError && <div className="error">{nicknameError}</div>}
      <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
        <button className="btn primary" onClick={onContinue}>
          Continue
        </button>
      </div>
      <div style={{ marginTop: 16, textAlign: 'left' }}>
        <h3 style={{ margin: '12px 0 8px' }}>How to play with friends</h3>
        <ol className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
          <li>Click Continue, then choose Create Room or Join Room.</li>
          <li>If hosting, share the 5-letter room code with your friends.</li>
          <li>Friends join using the code and set their nicknames.</li>
          <li>Everyone clicks I'm ready; the host starts the round.</li>
          <li>Draw the prompt before the timer runs out.</li>
          <li>View the results together and start the next round!</li>
        </ol>
      </div>
    </div>
  );
}



