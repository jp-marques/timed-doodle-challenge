// No React import needed for react-jsx runtime

export function HostView({ nickname, toJoin, toMenu, onCreate }: { nickname: string; toJoin: () => void; toMenu: () => void; onCreate: () => void }) {
  return (
    <div className="panel small" style={{ textAlign: 'center' }}>
      <h2>Welcome, {nickname}!</h2>
      <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={onCreate}>
          Create Room
        </button>
        <button className="btn" onClick={toJoin}>
          Join Room
        </button>
        <button className="btn secondary" onClick={toMenu}>
          Back
        </button>
      </div>
    </div>
  );
}


