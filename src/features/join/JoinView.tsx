// No React import needed for react-jsx runtime
import { validateNickname } from '../../lib/validation';

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
  const isNicknameInvalid = !!validateNickname(nickname);
  const isCodeInvalid = inputCode.trim().length !== 5;
  return (
    <div className="w-full max-w-[560px] mx-auto text-center">
      <h2 className="text-[clamp(24px,3.5vw,32px)] font-bold mb-2">Join Room</h2>
      <div className="text-slate-500">
        Playing as: <b>{nickname}</b>
      </div>
      <div className="label mb-2 mt-4">Room code</div>
      <input
        className="input"
        placeholder="ABCDE"
        value={inputCode}
        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
        maxLength={5}
      />
      {joinError && <div className="error">{joinError}</div>}
      <div className="flex justify-center gap-2 flex-wrap mt-2">
        <button className="btn primary" onClick={onJoin} disabled={isNicknameInvalid || isCodeInvalid} aria-disabled={isNicknameInvalid || isCodeInvalid}>
          Join
        </button>
        <button className="btn secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

