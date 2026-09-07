import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_SETTINGS = {
  focus: 25,
  short: 5,
  long: 15,
  longAfter: 4,
  autoStart: false,
  autoBreak: true,
  sound: true,
  notifications: false
};

const MODES = {
  focus: { label: "Focus", icon: "🎯" },
  short: { label: "Short Break", icon: "☕" },
  long: { label: "Long Break", icon: "🌿" }
};

function formatTime(total) {
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getInitialSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("pomodoro-settings") || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [settings, setSettings] = useState(getInitialSettings);
  const [mode, setMode] = useState("focus");
  const [seconds, setSeconds] = useState(settings.focus * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(() => Number(localStorage.getItem("pomodoro-completed") || 0));
  const [today, setToday] = useState(() => Number(localStorage.getItem("pomodoro-today") || 0));
  const [streak, setStreak] = useState(() => Number(localStorage.getItem("pomodoro-streak") || 0));
  const [sessions, setSessions] = useState(() => Number(localStorage.getItem("pomodoro-sessions") || 0));
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pomodoro-tasks") || "[]"); } catch { return []; }
  });
  const [task, setTask] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("pomodoro-theme") || "dark");
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [quote, setQuote] = useState("Small focus sessions create big results.");
  const audioRef = useRef(null);

  const totalSeconds = settings[mode] * 60;
  const progress = Math.max(0, Math.min(100, ((totalSeconds - seconds) / totalSeconds) * 100));

  const todayLabel = useMemo(() => new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "short", day: "numeric"
  }), []);

  useEffect(() => {
    document.title = `${formatTime(seconds)} • ${MODES[mode].label}`;
    localStorage.setItem("pomodoro-settings", JSON.stringify(settings));
  }, [seconds, mode, settings]);

  useEffect(() => {
    localStorage.setItem("pomodoro-completed", completed);
    localStorage.setItem("pomodoro-today", today);
    localStorage.setItem("pomodoro-streak", streak);
    localStorage.setItem("pomodoro-sessions", sessions);
    localStorage.setItem("pomodoro-tasks", JSON.stringify(tasks));
    localStorage.setItem("pomodoro-theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [completed, today, streak, sessions, tasks, theme]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setSeconds(s => {
        if (s > 1) return s - 1;
        finishMode();
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, mode, settings]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setSettings(s => ({ ...s, notifications: true }));
    }
  }, []);

  function playSound() {
    if (!settings.sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      [0, 0.18, 0.36].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = i === 1 ? 880 : 660;
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.15, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.16);
      });
    } catch {}
  }

  function notify(message) {
    if (settings.notifications && "Notification" in window && Notification.permission === "granted") {
      new Notification("FocusFlow", { body: message });
    }
  }

  function finishMode() {
    playSound();
    if (mode === "focus") {
      const nextCompleted = completed + 1;
      setCompleted(nextCompleted);
      setToday(v => v + 1);
      setSessions(v => v + 1);
      if (nextCompleted % settings.longAfter === 0) switchMode("long", settings.autoBreak);
      else switchMode("short", settings.autoBreak);
      notify("Focus session complete. Time for a break!");
    } else {
      switchMode("focus", settings.autoStart);
      notify("Break complete. Ready to focus?");
    }
  }

  function switchMode(next, autoRun = false) {
    setRunning(false);
    setMode(next);
    setSeconds(settings[next] * 60);
    setTimeout(() => setRunning(autoRun), 50);
  }

  function reset() {
    setRunning(false);
    setSeconds(settings[mode] * 60);
  }

  function skip() {
    if (mode === "focus") {
      switchMode(completed % settings.longAfter === settings.longAfter - 1 ? "long" : "short", false);
    } else switchMode("focus", false);
  }

  function addTask(e) {
    e.preventDefault();
    const value = task.trim();
    if (!value) return;
    setTasks(t => [...t, { id: Date.now(), text: value, done: false }]);
    setTask("");
  }

  function toggleTask(id) {
    setTasks(t => t.map(x => x.id === id ? { ...x, done: !x.done } : x));
  }

  function deleteTask(id) {
    setTasks(t => t.filter(x => x.id !== id));
  }

  function requestNotifications() {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then(p => {
      setSettings(s => ({ ...s, notifications: p === "granted" }));
    });
  }

  function updateSetting(key, value) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (key === mode && !running) setSeconds(Number(value) * 60);
  }

  function resetAllStats() {
    setCompleted(0); setToday(0); setStreak(0); setSessions(0);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">🍅</span><div><strong>FocusFlow</strong><small>Pomodoro Timer</small></div></div>
        <div className="top-actions">
          <span className="date">{todayLabel}</span>
          <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme">{theme === "dark" ? "☀️" : "🌙"}</button>
          <button className="icon-btn" onClick={() => setShowStats(v => !v)} title="Statistics">📊</button>
          <button className="icon-btn" onClick={() => setShowSettings(v => !v)} title="Settings">⚙️</button>
        </div>
      </header>

      <main className="layout">
        <section className="timer-card card">
          <div className="mode-tabs">
            {Object.entries(MODES).map(([key, value]) => (
              <button key={key} className={mode === key ? "active" : ""} onClick={() => switchMode(key, false)}>
                {value.icon} {value.label}
              </button>
            ))}
          </div>

          <div className="timer-ring" style={{ "--progress": `${progress}%` }}>
            <div className="ring-inner">
              <div className="mode-icon">{MODES[mode].icon}</div>
              <div className="time">{formatTime(seconds)}</div>
              <div className="status">{running ? "Stay focused" : "Ready when you are"}</div>
            </div>
          </div>

          <div className="timer-controls">
            <button className="secondary-btn" onClick={reset}>↻ Reset</button>
            <button className="primary-btn" onClick={() => setRunning(v => !v)}>{running ? "Ⅱ Pause" : "▶ Start"}</button>
            <button className="secondary-btn" onClick={skip}>Skip ↠</button>
          </div>

          <div className="session-line">
            <span>Sessions completed</span><strong>{completed}</strong>
            <div className="dots">{Array.from({length: settings.longAfter}, (_, i) => <i key={i} className={i < completed % settings.longAfter ? "filled" : ""}/>)}</div>
          </div>

          <p className="quote">“{quote}”</p>
        </section>

        <aside className="side-column">
          <section className="card task-card">
            <div className="card-title"><div><h2>Today’s Focus</h2><p>What are you working on?</p></div><span>✓ {tasks.filter(t => t.done).length}/{tasks.length}</span></div>
            <form className="task-input" onSubmit={addTask}>
              <input value={task} onChange={e => setTask(e.target.value)} placeholder="Add a task..." />
              <button type="submit">+</button>
            </form>
            <div className="task-list">
              {tasks.length === 0 && <div className="empty">Add your first task and start focusing.</div>}
              {tasks.map(t => <div className={`task ${t.done ? "done" : ""}`} key={t.id}>
                <button className="check" onClick={() => toggleTask(t.id)}>{t.done ? "✓" : ""}</button>
                <span>{t.text}</span><button className="delete" onClick={() => deleteTask(t.id)}>×</button>
              </div>)}
            </div>
          </section>

          <section className="card mini-stats">
            <div><span>🔥</span><strong>{streak}</strong><small>Day streak</small></div>
            <div><span>🍅</span><strong>{today}</strong><small>Today</small></div>
            <div><span>⏱️</span><strong>{Math.round((today * settings.focus) / 60)}h</strong><small>Focused</small></div>
          </section>

          <section className="card quick">
            <h2>Quick tips</h2>
            <p>🎯 Pick one task before starting.</p>
            <p>📵 Remove distractions during focus.</p>
            <p>🚶 Use breaks to move and reset.</p>
          </section>
        </aside>
      </main>

      {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
        <section className="modal card" onClick={e => e.stopPropagation()}>
          <div className="modal-head"><h2>Timer Settings</h2><button className="icon-btn" onClick={() => setShowSettings(false)}>×</button></div>
          <div className="settings-grid">
            <label>Focus (minutes)<input type="number" min="1" max="120" value={settings.focus} onChange={e => updateSetting("focus", Number(e.target.value))}/></label>
            <label>Short break<input type="number" min="1" max="60" value={settings.short} onChange={e => updateSetting("short", Number(e.target.value))}/></label>
            <label>Long break<input type="number" min="1" max="90" value={settings.long} onChange={e => updateSetting("long", Number(e.target.value))}/></label>
            <label>Long break after<input type="number" min="1" max="12" value={settings.longAfter} onChange={e => updateSetting("longAfter", Number(e.target.value))}/></label>
          </div>
          <div className="toggles">
            <label><input type="checkbox" checked={settings.autoStart} onChange={e => updateSetting("autoStart", e.target.checked)}/> Auto-start next focus</label>
            <label><input type="checkbox" checked={settings.autoBreak} onChange={e => updateSetting("autoBreak", e.target.checked)}/> Auto-start breaks</label>
            <label><input type="checkbox" checked={settings.sound} onChange={e => updateSetting("sound", e.target.checked)}/> Completion sound</label>
            <label><input type="checkbox" checked={settings.notifications} onChange={e => updateSetting("notifications", e.target.checked)}/> Browser notifications</label>
          </div>
          {!settings.notifications && <button className="outline-btn" onClick={requestNotifications}>Enable notifications</button>}
          <button className="danger-btn" onClick={resetAllStats}>Reset statistics</button>
        </section>
      </div>}

      {showStats && <div className="modal-backdrop" onClick={() => setShowStats(false)}>
        <section className="modal card" onClick={e => e.stopPropagation()}>
          <div className="modal-head"><h2>Progress</h2><button className="icon-btn" onClick={() => setShowStats(false)}>×</button></div>
          <div className="big-stat"><strong>{today}</strong><span>Pomodoros today</span></div>
          <div className="stats-row"><div><strong>{completed}</strong><span>Total completed</span></div><div><strong>{streak}</strong><span>Current streak</span></div><div><strong>{Math.round(today * settings.focus)}</strong><span>Minutes focused</span></div></div>
          <p className="muted">Your tasks, settings and statistics are saved automatically in your browser.</p>
        </section>
      </div>}

      <footer>FocusFlow • Stay consistent, one session at a time.</footer>
    </div>
  );
}
