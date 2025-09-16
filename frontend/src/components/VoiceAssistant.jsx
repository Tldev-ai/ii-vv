import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, MessageCircle, PhoneOff } from 'lucide-react';

/**
 * VoiceAssistant
 * - One-click start -> greet -> auto listen/reply loop
 * - Slot filling then auto-end
 */

const VoiceAssistant = () => {
  // ---- visible state ----
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState([]);

  // ---- refs ----
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const currentUtteranceRef = useRef(null);

  const finalTextRef = useRef('');
  const sessionActiveRef = useRef(false);
  const pausedByStopRef = useRef(false);
  const startAfterTTSRef = useRef(false);
  const greetHardCapTimerRef = useRef(null);
  const speakWatchdogRef = useRef(null);
  const startingListenRef = useRef(false);
  const lastListenStartAtRef = useRef(0);
  const currentUserBubbleIndexRef = useRef(null);
  const heardThisTurnRef = useRef(false);

  const inactivityTimerRef = useRef(null);
  const hangTimerRef = useRef(null);

  // ---- slot filling state ----
  const [intent, setIntent] = useState(null); // 'home_tuition' | 'coaching'
  const [slots, setSlots] = useState({
    track: null,       // 'home_tuition' | 'coaching'
    name: null,
    grade: null,
    board: null,       // CBSE/ICSE/IGCSE/IB/State
    location: null,    // city/area | 'Online'
    budget: null,      // optional
    teacherReq: null,  // preferences text (optional)
  });
  const askedSlotRef = useRef(null); // tracks the slot we just asked, to avoid re-asking

  // ===== connection (mock/no-op) =====
  const connectToOpenAI = async () => {
    try {
      setConnectionStatus('Connecting...');
      wsRef.current = {
        readyState: WebSocket.OPEN,
        send: (d) => console.log('WS send:', d),
        close: () => { setIsConnected(false); setConnectionStatus('Disconnected'); }
      };
      setIsConnected(true);
      setConnectionStatus('Connected');
    } catch (e) {
      console.error('connect error', e);
      setConnectionStatus('Connection Failed');
    }
  };

  const endChat = () => {
    // stop TTS
    try { window.speechSynthesis.cancel(); } catch {}
    setIsSpeaking(false);
    currentUtteranceRef.current = null;

    // stop SR
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setIsListening(false);

    // timers
    if (speakWatchdogRef.current) { clearInterval(speakWatchdogRef.current); speakWatchdogRef.current = null; }
    if (greetHardCapTimerRef.current) { clearTimeout(greetHardCapTimerRef.current); greetHardCapTimerRef.current = null; }
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    if (hangTimerRef.current) { clearTimeout(hangTimerRef.current); hangTimerRef.current = null; }

    // ws
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;

    setIsConnected(false);
    setConnectionStatus('Disconnected');

    // session flags
    sessionActiveRef.current = false;
    pausedByStopRef.current = false;
    startAfterTTSRef.current = false;
    startingListenRef.current = false;
    lastListenStartAtRef.current = 0;
    currentUserBubbleIndexRef.current = null;
    heardThisTurnRef.current = false;

    // reset slots for next call
    setIntent(null);
    setSlots({
      track: null, name: null, grade: null, board: null, location: null, budget: null, teacherReq: null
    });
    askedSlotRef.current = null;
  };

  useEffect(() => () => endChat(), []); // cleanup on unmount

  // ===== utils =====
  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  async function warmupMicPermission() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) {
      console.warn('Mic permission denied:', e);
      return false;
    }
  }

  // ===== inactivity (2m -> warn, +15s -> hang) =====
  function scheduleInactivity() {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (hangTimerRef.current) clearTimeout(hangTimerRef.current);

    inactivityTimerRef.current = setTimeout(() => {
      speakAndLog("Are you there, ma'am/sir? I'm not hearing your voice.");
      hangTimerRef.current = setTimeout(() => {
        speakAndLog("I'll end the call for now. You can reconnect anytime.");
        setTimeout(endChat, 900);
      }, 15000);
    }, 120000);
  }
  function clearInactivity() {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    if (hangTimerRef.current) { clearTimeout(hangTimerRef.current); hangTimerRef.current = null; }
  }

  // ===== one-click start =====
  const onAskClick = async () => {
    if (!isConnected) await connectToOpenAI();

    // If paused via Stop, just resume listening (no re-greet)
    if (sessionActiveRef.current && pausedByStopRef.current) {
      pausedByStopRef.current = false;
      startListeningSafe();
      return;
    }

    if (!sessionActiveRef.current) {
      const ok = await warmupMicPermission();
      if (!ok) { alert('Please allow microphone access.'); return; }

      sessionActiveRef.current = true;
      pausedByStopRef.current = false;
      startAfterTTSRef.current = true;

      speakAndLog(`${timeGreeting()} ma'am/sir. How can I help you today?`);

      // Hard cap: if no onend (buggy browsers), force start after 3.5s
      if (greetHardCapTimerRef.current) clearTimeout(greetHardCapTimerRef.current);
      greetHardCapTimerRef.current = setTimeout(() => {
        if (!sessionActiveRef.current || pausedByStopRef.current) return;
        if (!isListening && !isSpeaking && !isProcessing) startListeningSafe();
      }, 3500);
      return;
    }

    if (!isSpeaking && !isProcessing && !isListening) startListeningSafe();
  };

  // ===== Stop button: pause loop =====
  const onStopClick = () => {
    pausedByStopRef.current = true;

    try { window.speechSynthesis.cancel(); } catch {}
    setIsSpeaking(false);
    currentUtteranceRef.current = null;

    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setIsListening(false);

    clearInactivity();
  };

  // ===== Speech Recognition =====
  function ensureRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('SpeechRecognition not supported (use Chrome).'); return null; }
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    return rec;
  }

  function startListeningSafe() {
    if (!sessionActiveRef.current) return;
    if (pausedByStopRef.current) return;
    if (isSpeaking || isProcessing) return;

    const now = Date.now();
    if (startingListenRef.current) return;
    if (isListening) return;
    if (recognitionRef.current) return;
    if (now - lastListenStartAtRef.current < 400) return;

    startingListenRef.current = true;
    lastListenStartAtRef.current = now;
    setTimeout(startListeningCore, 120);
  }

  function startListeningCore() {
    if (!sessionActiveRef.current || pausedByStopRef.current) { startingListenRef.current = false; return; }

    const rec = ensureRecognition();
    if (!rec) { startingListenRef.current = false; return; }

    recognitionRef.current = rec;
    setIsListening(true);
    setTranscript('');
    finalTextRef.current = '';
    heardThisTurnRef.current = false;
    currentUserBubbleIndexRef.current = null;

    scheduleInactivity();

    rec.onresult = (e) => {
      scheduleInactivity();
      let finalText = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      const show = (finalText || interim || '').trim();
      setTranscript(show);
      if (finalText) finalTextRef.current = finalText.trim();

      if (!heardThisTurnRef.current) {
        heardThisTurnRef.current = true;
        const stamp = new Date().toLocaleTimeString();
        setConversation(prev => {
          const next = [...prev, { type: 'user', message: show || '…', timestamp: stamp }];
          currentUserBubbleIndexRef.current = next.length - 1;
          return next;
        });
      } else {
        setConversation(prev => {
          const next = [...prev];
          const idx = currentUserBubbleIndexRef.current;
          if (idx != null && next[idx]) next[idx].message = show || next[idx].message;
          return next;
        });
      }
    };

    rec.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
      startingListenRef.current = false;
    };

    rec.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      startingListenRef.current = false;
      clearInactivity();

      const text = (finalTextRef.current || transcript || '').trim();
      if (!text) {
        if (sessionActiveRef.current && !pausedByStopRef.current) {
          setTimeout(startListeningSafe, 600);
        }
        return;
      }
      setIsProcessing(true);
      handleUserText(text);
    };

    rec.start();
  }

  // ===== Slot filling logic =====
  const order = ['track', 'name', 'grade', 'board', 'location', 'budget', 'teacherReq'];
  const prompts = {
    track: "Do you need home tuitions (online/offline) or IIT/SAT coaching?",
    name: "May I have the student's or the parent's name?",
    grade: "Which grade is the student in?",
    board: "Which board? (CBSE / ICSE / IGCSE / IB / State)",
    location: "Which location or city are you in? You can also say Online.",
    budget: "Any budget range in mind (per hour or per month)? This is optional.",
    teacherReq: "Any teacher preferences? (gender, experience, language, timings) You can say 'no preference'.",
  };

  function detectIntentFrom(text) {
    const t = text.toLowerCase();
    if (t.includes('home tuition') || t.includes('home tuitions') || t.includes('offline') || t.includes('teacher at home')) {
      return 'home_tuition';
    }
    if (t.includes('iit') || t.includes('jee') || t.includes('sat')) return 'coaching';
    return null;
  }

  function fillSlotsFrom(text, current) {
    const out = { ...current };
    const t = text || '';
    const lower = t.toLowerCase();

    // track
    const maybeIntent = detectIntentFrom(text);
    if (!out.track && maybeIntent) out.track = maybeIntent;

    // name
    if (!out.name) {
      const m = t.match(/\b(my name is|this is|i am)\s+([a-z .'-]{2,})/i);
      if (m) out.name = m[2].trim();
    }

    // grade
    if (!out.grade) {
      const m = lower.match(/\b(?:grade|class)\s*(\d{1,2})\b/);
      if (m) out.grade = m[1];
    }

    // board
    if (!out.board) {
      const m = lower.match(/\b(cbse|icse|igcse|ib|state)\b/);
      if (m) out.board = m[1].toUpperCase();
    }

    // location
    if (!out.location) {
      if (/\bonline\b/i.test(t)) out.location = 'Online';
      else {
        const m = t.match(/\b(?:in|at)\s+([a-z0-9 .,'-]{3,})$/i);
        if (m) out.location = m[1].trim();
      }
    }

    // budget
    if (!out.budget) {
      const m = t.match(/(?:₹\s*|rs\.?\s*)?(\d{3,6})(?:\s*(?:per|\/)\s*(hour|month))?/i);
      if (m) out.budget = m[0].replace(/\s+/g, ' ');
    }

    // teacher requirements (keywords)
    if (!out.teacherReq && /(female|male|experience|years|language|timing|evening|morning|weekend|weekday|no preference)/i.test(t)) {
      out.teacherReq = t.trim();
    }

    return out;
  }

  function nextMissingSlot(s) {
    for (const k of order) {
      if (!s[k]) return k;
    }
    return null;
  }

  function summarize(s) {
    const gradeStr = s.grade ? `grade ${s.grade}` : 'grade -';
    const boardStr = s.board || '-';
    const locStr = s.location || '-';
    const budStr = s.budget || '-';
    const prefStr = s.teacherReq || '-';
    const who = s.name ? `Thanks ${s.name}. ` : 'Thanks. ';
    const trackStr = s.track === 'home_tuition' ? 'Home Tuitions' : 'IIT/SAT coaching';
    return `${who}I noted ${trackStr}: ${gradeStr}, board ${boardStr}, location ${locStr}, budget ${budStr}, preferences: ${prefStr}. We will get back to you soon. Ending the call now.`;
  }

  function handleUserText(text) {
    // Fill from user text
    const updatedSlots = fillSlotsFrom(text, { ...slots });
    if (!intent) {
      const d = detectIntentFrom(text);
      if (d) setIntent(d);
      if (updatedSlots.track && !intent) setIntent(updatedSlots.track === 'home_tuition' ? 'home_tuition' : 'coaching');
    }
    setSlots(updatedSlots);

    // If we just asked a slot and user answered, clear askedSlot marker
    if (askedSlotRef.current && updatedSlots[askedSlotRef.current]) {
      askedSlotRef.current = null;
    }

    // Decide next step
    const missing = nextMissingSlot(updatedSlots);
    if (missing) {
      // avoid repeating same prompt twice in a row
      if (askedSlotRef.current === missing) {
        // User didn't answer; ask a gentle rephrase
        const reask = missing === 'track'
          ? "Do you prefer home tuitions or IIT/SAT coaching?"
          : prompts[missing];
        speakAndLog(reask);
      } else {
        askedSlotRef.current = missing;
        speakAndLog(prompts[missing]);
      }
      return;
    }

    // All collected → summarize and end call
    const msg = summarize(updatedSlots);
    speakAndLog(msg);

    // End after TTS
    const endAfter = () => setTimeout(endChat, 1000);
    // attach one-time ender using a short TTS (so we don't rely on onend here)
    setTimeout(endAfter, 2500); // safety: in case onend/watchdog took longer
  }

  // ===== TTS helpers =====
  function speakAndLog(text) {
    setIsProcessing(false);
    setIsSpeaking(true);

    setConversation(prev => [
      ...prev,
      { type: 'assistant', message: text, timestamp: new Date().toLocaleTimeString() }
    ]);

    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95; u.pitch = 1;

      currentUtteranceRef.current = u;

      const startListen = () => {
        if (speakWatchdogRef.current) { clearInterval(speakWatchdogRef.current); speakWatchdogRef.current = null; }
        if (greetHardCapTimerRef.current) { clearTimeout(greetHardCapTimerRef.current); greetHardCapTimerRef.current = null; }

        setIsSpeaking(false);
        currentUtteranceRef.current = null;

        if (pausedByStopRef.current) return;

        if (startAfterTTSRef.current) startAfterTTSRef.current = false;

        if (sessionActiveRef.current) {
          scheduleInactivity();
          startListeningSafe();
        }
      };

      u.onend = startListen;
      u.onerror = startListen;

      window.speechSynthesis.speak(u);

      // Watchdog (covers missing onend)
      if (speakWatchdogRef.current) clearInterval(speakWatchdogRef.current);
      speakWatchdogRef.current = setInterval(() => {
        const speaking = window?.speechSynthesis?.speaking;
        if (!speaking) startListen();
      }, 300);
    } catch (e) {
      console.error('TTS error', e);
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      if (!pausedByStopRef.current && sessionActiveRef.current) {
        scheduleInactivity();
        startListeningSafe();
      }
    }
  }

  // ===== UI helpers =====
  const getStatusColor = () => {
    if (isListening) return 'bg-red-500';
    if (isProcessing) return 'bg-yellow-500';
    if (isSpeaking) return 'bg-blue-500';
    if (isConnected) return 'bg-green-500';
    return 'bg-gray-400';
  };
  const getStatusText = () => {
    if (!sessionActiveRef.current) return 'Idle';
    if (pausedByStopRef.current) return 'Paused';
    if (isListening) return 'Listening...';
    if (isProcessing) return 'Processing...';
    if (isSpeaking) return 'Speaking...';
    return 'Idle';
  };

  // ===== greet once then listen =====
  const onComponentAsk = async () => {
    await onAskClick();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">iiTuitions Assistant</h1>
          <p className="text-gray-600">Your friendly guide to IIT-JEE & Home Tuitions</p>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          {/* Status */}
          <div className="flex items-center justify-center mb-6">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} mr-3`}></div>
            <span className="text-lg font-medium text-gray-700">{getStatusText()}</span>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={onComponentAsk}
              disabled={isProcessing || isSpeaking}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Mic size={18} />
              Ask Question
            </button>

            <button
              onClick={onStopClick}
              disabled={(!isSpeaking && !isListening) && !sessionActiveRef.current}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <MicOff size={18} />
              Stop
            </button>

            <button
              onClick={endChat}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <PhoneOff size={18} />
              End Chat
            </button>
          </div>

          {/* Live transcript */}
          {transcript && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-1">You said:</h3>
              <p className="text-blue-700">{transcript}</p>
            </div>
          )}
        </div>

        {/* Conversation */}
        {conversation.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <MessageCircle className="mr-2" size={22} />
              Conversation
            </h2>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {conversation.map((msg, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg ${msg.type === 'user' ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-medium ${msg.type === 'user' ? 'text-blue-800' : 'text-gray-800'}`}>
                      {msg.type === 'user' ? 'You' : 'iiTuitions Assistant'}
                    </span>
                    <span className="text-xs text-gray-500">{msg.timestamp}</span>
                  </div>
                  <p className="text-gray-700">{msg.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-800 mb-2">About iiTuitions</h3>
          <p className="text-blue-700">
            Personalized 1-on-1 mentorship by IIT/NIT alumni for IIT-JEE & SAT, plus online/offline home tuitions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
