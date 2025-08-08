import { useState } from 'react';
import type { Player } from '../types';

export default function ResultsGrid({ drawings, players }: { drawings: Record<string, string>; players: Player[] }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 9;
  const entries = Object.entries(drawings);
  const pagedEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(entries.length / PAGE_SIZE);

  return (
    <>
      <div className="results-grid" style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {pagedEntries.map(([id, url], idx) => {
          const player = players.find((p) => p.id === id);
          return (
            <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 380 }}>
              <img
                src={url}
                alt="drawing"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  marginBottom: '8px',
                  border: '1px solid var(--line)',
                }}
              />
              <div className="text-center mt-2">
                <span style={{ fontWeight: 600 }}>{player?.nickname || `Player ${idx + 1 + page * PAGE_SIZE}`}</span>
              </div>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '18px 0 0 0' }}>
          <button className="game-btn" style={{ minWidth: 80 }} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            Previous
          </button>
          <span style={{ alignSelf: 'center', fontWeight: 600, color: '#2563eb' }}>
            Page {page + 1} / {totalPages}
          </span>
          <button
            className="game-btn"
            style={{ minWidth: 80 }}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}


