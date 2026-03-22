import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Star, RefreshCw } from 'lucide-react';

interface WaitingGameProps {
  minutesUntil: number; // minutes until check-in opens
  onCheckInReady: () => void;
}

// ── GAME 1: Emoji City Guesser ────────────────────────────────
const CITY_CLUES = [
  { emojis: '🌊🎬🐟🏙️', answer: 'MUMBAI', hint: 'Financial capital' },
  { emojis: '🌸👑🏰🐪', answer: 'JAIPUR', hint: 'Pink city of Rajasthan' },
  { emojis: '☕🌿🐘🏞️', answer: 'COORG', hint: 'Coffee hills of Karnataka' },
  { emojis: '🖥️💻🌆🌳', answer: 'BANGALORE', hint: 'Silicon Valley of India' },
  { emojis: '🌊🛕🎭🌴', answer: 'CHENNAI', hint: 'Gateway of South India' },
  { emojis: '🕌🍛🏛️🌙', answer: 'HYDERABAD', hint: 'City of Nizams' },
  { emojis: '🏔️❄️🌨️🧣', answer: 'SHIMLA', hint: 'Summer capital of British India' },
  { emojis: '🌹🏛️🦁🌿', answer: 'MYSORE', hint: 'City of palaces' },
  { emojis: '🌊🐚🌴🏖️', answer: 'GOA', hint: 'Beach paradise' },
  { emojis: '🕍🚂🌄🍵', answer: 'DARJEELING', hint: 'Tea gardens in the hills' },
  { emojis: '🏯🌊⛵🐟', answer: 'KOCHI', hint: 'Queen of the Arabian Sea' },
  { emojis: '🌺🐯🌿🍃', answer: 'OOTY', hint: 'Queen of hill stations' },
  { emojis: '🏜️🐪🌅🔮', answer: 'JAISALMER', hint: 'Golden city in the desert' },
  { emojis: '🛕🌊🌙⭐', answer: 'VARANASI', hint: 'Oldest living city' },
  { emojis: '🍎🏔️🌸🏡', answer: 'MANALI', hint: 'Apple orchards and snow' },
];

function EmojiCityGame({ onScore }: { onScore: (s: number) => void }) {
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [shuffled] = useState(() => [...CITY_CLUES].sort(() => Math.random() - 0.5).slice(0, 5));

  const handleGuess = () => {
    const correct = input.trim().toUpperCase() === shuffled[current].answer;
    setResult(correct ? 'correct' : 'wrong');
    const newScore = correct ? score + 10 : score;
    if (correct) setScore(newScore);
    setTimeout(() => {
      if (current < shuffled.length - 1) {
        setCurrent(c => c + 1);
        setRound(r => r + 1);
        setInput('');
        setResult(null);
      } else {
        onScore(newScore);
      }
    }, 1000);
  };

  const clue = shuffled[current];
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Round {round}/5 • Score: {score}</p>
      <motion.div key={current} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ fontSize: 48, marginBottom: 12, letterSpacing: 4 }}>{clue.emojis}</motion.div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>💡 {clue.hint}</p>
      <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === 'Enter' && input.trim() && handleGuess()}
        placeholder="Which Indian city?"
        style={{ width: '100%', height: 44, borderRadius: 12, border: `2px solid ${result === 'correct' ? '#22c55e' : result === 'wrong' ? '#ef4444' : '#e2e8f0'}`, padding: '0 14px', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none', boxSizing: 'border-box', background: result === 'correct' ? '#f0fdf4' : result === 'wrong' ? '#fef2f2' : '#fff', marginBottom: 10, letterSpacing: '0.1em' }} />
      {result && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: 13, fontWeight: 700, color: result === 'correct' ? '#16a34a' : '#dc2626', marginBottom: 10 }}>
          {result === 'correct' ? '✅ Correct! +10 points' : `❌ It was ${clue.answer}`}
        </motion.p>
      )}
      <motion.button whileTap={{ scale: 0.96 }} onClick={handleGuess} disabled={!input.trim() || !!result}
        style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #1E88E5, #1565C0)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: input.trim() && !result ? 'pointer' : 'default', opacity: !input.trim() || !!result ? 0.5 : 1 }}>
        Guess! 🎯
      </motion.button>
    </div>
  );
}

// ── GAME 2: Catch the Bus ─────────────────────────────────────
function CatchTheBusGame({ onScore }: { onScore: (s: number) => void }) {
  const [busPos, setBusPos] = useState({ x: 50, y: 50 });
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(1200);

  const moveBus = useCallback(() => {
    setBusPos({ x: Math.random() * 80 + 5, y: Math.random() * 70 + 10 });
  }, []);

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(moveBus, speed);
    return () => clearInterval(interval);
  }, [moveBus, speed, gameOver]);

  useEffect(() => {
    if (gameOver) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { setGameOver(true); onScore(score); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameOver, score, onScore]);

  const handleCatch = () => {
    if (gameOver) return;
    const newScore = score + 5;
    setScore(newScore);
    moveBus();
    if (newScore % 25 === 0) setSpeed(s => Math.max(500, s - 150));
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1E88E5' }}>Score: {score}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: timeLeft < 5 ? '#ef4444' : '#64748b' }}>⏱ {timeLeft}s</span>
      </div>
      <div style={{ position: 'relative', width: '100%', height: 180, background: 'linear-gradient(135deg, #E3F2FD, #FFE8E0)', borderRadius: 16, overflow: 'hidden', border: '2px solid rgba(30,136,229,0.15)', marginBottom: 12 }}
        onClick={() => { if (!gameOver) setMisses(m => m + 1); }}>
        {/* Road */}
        <div style={{ position: 'absolute', bottom: 0, width: '100%', height: 30, background: '#334155', borderRadius: '0 0 14px 14px' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 3, background: 'repeating-linear-gradient(90deg, #fbbf24 0px, #fbbf24 20px, transparent 20px, transparent 40px)', transform: 'translateY(-50%)' }} />
        </div>
        <motion.div animate={{ left: `${busPos.x}%`, top: `${busPos.y}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{ position: 'absolute', fontSize: 36, cursor: 'pointer', userSelect: 'none', transform: 'translate(-50%, -50%)' }}
          onClick={e => { e.stopPropagation(); handleCatch(); }}>
          🚌
        </motion.div>
        {gameOver && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <p style={{ fontSize: 24, fontWeight: 800 }}>Time's up! 🎉</p>
              <p style={{ fontSize: 14 }}>You caught {score / 5} buses!</p>
            </div>
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8' }}>Tap the bus before it moves! Gets faster as you score 🏃</p>
    </div>
  );
}

// ── GAME 3: Travel Word Scramble ──────────────────────────────
const TRAVEL_WORDS = [
  { word: 'JOURNEY', hint: 'A long trip from one place to another' },
  { word: 'PLATFORM', hint: 'Where you board the train' },
  { word: 'CONDUCTOR', hint: 'Checks your ticket on the bus' },
  { word: 'LUGGAGE', hint: 'Your bags and suitcases' },
  { word: 'DEPARTURE', hint: 'The time you leave' },
  { word: 'PASSENGER', hint: 'A traveler who is not driving' },
  { word: 'TERMINAL', hint: 'The main building of a transport hub' },
  { word: 'ITINERARY', hint: 'Your travel plan' },
  { word: 'BOARDING', hint: 'Getting on the vehicle' },
  { word: 'CORRIDOR', hint: 'The path along the train' },
];

function scramble(word: string): string {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = arr.join('');
  return result === word ? scramble(word) : result;
}

function WordScrambleGame({ onScore }: { onScore: (s: number) => void }) {
  const [words] = useState(() => [...TRAVEL_WORDS].sort(() => Math.random() - 0.5).slice(0, 5));
  const [current, setCurrent] = useState(0);
  const [scrambled, setScrambled] = useState(() => scramble(TRAVEL_WORDS[0].word));
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    setScrambled(scramble(words[current].word));
  }, [current, words]);

  const handleGuess = () => {
    const correct = input.trim().toUpperCase() === words[current].word;
    setResult(correct ? 'correct' : 'wrong');
    const newScore = correct ? score + 10 : score;
    if (correct) setScore(newScore);
    setTimeout(() => {
      if (current < words.length - 1) {
        setCurrent(c => c + 1);
        setInput('');
        setResult(null);
      } else {
        onScore(newScore);
      }
    }, 1000);
  };

  const w = words[current];
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Word {current + 1}/5 • Score: {score}</p>
      <motion.div key={current} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ fontSize: 28, fontWeight: 900, letterSpacing: 6, color: '#1E88E5', background: 'rgba(30,136,229,0.08)', borderRadius: 14, padding: '16px', marginBottom: 12, fontFamily: 'monospace' }}>
        {scrambled}
      </motion.div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>💡 {w.hint}</p>
      <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === 'Enter' && input.trim() && handleGuess()}
        placeholder="Unscramble the word..."
        style={{ width: '100%', height: 44, borderRadius: 12, border: `2px solid ${result === 'correct' ? '#22c55e' : result === 'wrong' ? '#ef4444' : '#e2e8f0'}`, padding: '0 14px', fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none', boxSizing: 'border-box', background: result === 'correct' ? '#f0fdf4' : result === 'wrong' ? '#fef2f2' : '#fff', marginBottom: 10, letterSpacing: '0.15em' }} />
      {result && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: 13, fontWeight: 700, color: result === 'correct' ? '#16a34a' : '#dc2626', marginBottom: 10 }}>
          {result === 'correct' ? '✅ Correct! +10 points' : `❌ It was "${w.word}"`}
        </motion.p>
      )}
      <motion.button whileTap={{ scale: 0.96 }} onClick={handleGuess} disabled={!input.trim() || !!result}
        style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: input.trim() && !result ? 'pointer' : 'default', opacity: !input.trim() || !!result ? 0.5 : 1 }}>
        Submit! 🔤
      </motion.button>
    </div>
  );
}

// ── MAIN WAITING GAME COMPONENT ───────────────────────────────
export const WaitingGame: React.FC<WaitingGameProps> = ({ minutesUntil, onCheckInReady }) => {
  const [gameType] = useState<0 | 1 | 2>(() => Math.floor(Math.random() * 3) as 0 | 1 | 2);
  const [gameFinished, setGameFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(minutesUntil * 60);
  const [gameKey, setGameKey] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { onCheckInReady(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onCheckInReady]);

  const handleScore = (score: number) => {
    setFinalScore(score);
    setGameFinished(true);
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  const gameNames = ['🏙️ City Guesser', '🚌 Catch the Bus', '🔤 Word Scramble'];
  const gameColors = ['#1E88E5', '#FF6B35', '#22c55e'];

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #E3F2FD 0%, #ffffff 45%, #FFE8E0 100%)', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 16px', background: `linear-gradient(135deg, ${gameColors[gameType]}, ${gameColors[gameType]}dd)`, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 11, opacity: 0.8, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Check-in opens in</p>
            <p style={{ fontSize: 28, fontWeight: 900, margin: 0, fontFamily: 'monospace' }}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Timer style={{ width: 28, height: 28, opacity: 0.8 }} />
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '8px 14px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
            🎮 Play while you wait! — {gameNames[gameType]}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'rgba(0,0,0,0.08)' }}>
        <motion.div
          style={{ height: '100%', background: gameColors[gameType] }}
          animate={{ width: `${100 - (timeLeft / (minutesUntil * 60)) * 100}%` }}
          transition={{ duration: 1 }} />
      </div>

      {/* Game area */}
      <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' }}>
        <AnimatePresence mode="wait">
          {gameFinished ? (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>Game Over!</h2>
              <p style={{ fontSize: 16, color: '#64748b', margin: '0 0 24px' }}>You scored <strong style={{ color: gameColors[gameType] }}>{finalScore} points</strong></p>

              <div style={{ background: '#fff', borderRadius: 20, padding: '20px', border: '2px solid rgba(30,136,229,0.1)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  {[...Array(Math.min(5, Math.floor(finalScore / 10)))].map((_, i) => (
                    <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.1 }}>
                      <Star style={{ width: 24, height: 24, color: '#fbbf24', fill: '#fbbf24' }} />
                    </motion.div>
                  ))}
                  {[...Array(Math.max(0, 5 - Math.floor(finalScore / 10)))].map((_, i) => (
                    <Star key={i} style={{ width: 24, height: 24, color: '#e2e8f0' }} />
                  ))}
                </div>
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                  {finalScore >= 40 ? '🌟 Travel Expert!' : finalScore >= 20 ? '✈️ Frequent Traveler!' : '🎒 Travel Newbie!'}
                </p>
              </div>

              <motion.button whileTap={{ scale: 0.96 }}
                onClick={() => { setGameFinished(false); setFinalScore(0); setGameKey(k => k + 1); }}
                style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${gameColors[gameType]}, ${gameColors[gameType]}cc)`, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <RefreshCw style={{ width: 18, height: 18 }} />
                Play Again
              </motion.button>

              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16 }}>
                ⏳ Check-in opens in {mins}:{String(secs).padStart(2, '0')} — we'll notify you!
              </p>
            </motion.div>
          ) : (
            <motion.div key={`game-${gameKey}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ background: '#fff', borderRadius: 20, padding: '20px', border: '2px solid rgba(30,136,229,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                {gameType === 0 && <EmojiCityGame onScore={handleScore} />}
                {gameType === 1 && <CatchTheBusGame onScore={handleScore} />}
                {gameType === 2 && <WordScrambleGame onScore={handleScore} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};