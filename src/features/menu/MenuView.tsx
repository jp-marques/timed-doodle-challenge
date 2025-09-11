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
    <div className="w-full text-center">
      <div className="mx-auto max-w-[560px] grid gap-4 justify-items-center">
        <div>
          <h1 className="text-[clamp(40px,6vw,56px)] leading-[1.05] font-bold m-0">Timed Doodle</h1>
          <div className="text-slate-500 leading-relaxed mt-2">Race the clock to draw prompts with friends.</div>

          <div className="text-slate-500 text-sm mt-1" aria-hidden>
            Instant play • Multiplayer • Zero hassle
          </div>

          <div className="mt-6">
            <input
              className="input"
              placeholder="Enter your nickname"
              value={nickname}
              onChange={onNicknameChange}
              maxLength={15}
              aria-invalid={!!nicknameError}
              aria-describedby={nicknameError ? 'nickname-error' : undefined}
            />
            {nicknameError && (<div id="nickname-error" className="error">{nicknameError}</div>)}
          </div>

          <div className="flex flex-col items-stretch gap-4 mt-6">
            <button className="btn primary cta" onClick={onCreate} disabled={isNicknameInvalid} aria-disabled={isNicknameInvalid}>Create Room</button>
            <div className="flex justify-center">
              <button className="bg-transparent border-0 text-slate-500 px-2 py-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 rounded" onClick={onJoin}>Have a code? Join room</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-6">
            <div className="inline-flex items-center justify-center gap-2 text-slate-900 text-sm">
              <span className="inline-flex items-center justify-center w-[22px] h-[22px] border border-slate-200 rounded-full text-blue-600 bg-white" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="text-slate-500 whitespace-nowrap">Create or join</span>
            </div>
            <div className="inline-flex items-center justify-center gap-2 text-slate-900 text-sm">
              <span className="inline-flex items-center justify-center w-[22px] h-[22px] border border-slate-200 rounded-full text-blue-600 bg-white" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="text-slate-500 whitespace-nowrap">Get a prompt</span>
            </div>
            <div className="inline-flex items-center justify-center gap-2 text-slate-900 text-sm">
              <span className="inline-flex items-center justify-center w-[22px] h-[22px] border border-slate-200 rounded-full text-blue-600 bg-white" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </span>
              <span className="text-slate-500 whitespace-nowrap">Beat the timer</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



