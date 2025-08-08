// No React import needed for react-jsx runtime

export function JoinView({
  nickname,
  inputCode,
  joinError,
  setInputCode,
  onJoin,
  onBack,
}: {
  nickname: string;
  inputCode: string;
  joinError: string;
  setInputCode: (code: string) => void;
  onJoin: () => void;
  onBack: () => void;
}) {
  return (
    <div className="panel small" style={{ textAlign: 'center' }}>
      <h2>Join Room</h2>
      <div className="muted">
        Playing as: <b>{nickname}</b>
      </div>
      <div className="label" style={{ marginBottom: 8 }}>
        Room code
      </div>
      <input
        className="input"
        placeholder="ABCDE"
        value={inputCode}
        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
        maxLength={5}
      />
      {joinError && <div className="error">{joinError}</div>}
      <div className="row" style={{ justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={onJoin}>
          Join
        </button>
        <button className="btn secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}


