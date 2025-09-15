import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, MessageCircle, Phone, PhoneOff, FileText } from 'lucide-react';

const VoiceAssistant = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isInterrupted, setIsInterrupted] = useState(false);
  
  // Sales script state management
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [detectedTags, setDetectedTags] = useState([]);
  const [conversationPhase, setConversationPhase] = useState('welcome');
  
  const wsRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const currentUtteranceRef = useRef(null);

  // Sales script configuration
  const triageQuestions = [
    {
      id: 'grade_exam',
      question: "Hello! I'm here to help you with IIT-JEE preparation. First, could you tell me what grade you're in and when you're planning to take the exam?",
      followUp: "Thank you for that information."
    },
    {
      id: 'current_coaching',
      question: "What school or coaching institute are you currently attending, and how often do you have weekly tests?",
      followUp: "I see, that gives me a good picture of your current setup."
    },
    {
      id: 'frustration',
      question: "What has been your biggest frustration or challenge in the last 30 days with your JEE preparation?",
      followUp: "I understand, that's a common challenge many students face."
    },
    {
      id: 'subject_split',
      question: "Let's talk about Physics, Chemistry, and Math - for each subject, would you say your main challenge is understanding concepts or solving numerical problems?",
      followUp: "That helps me understand where you need the most support."
    },
    {
      id: 'pace_stress',
      question: "How do you feel about the pace of your current studies? Do you prefer a fast-paced approach or do you need more time to absorb concepts?",
      followUp: "Good to know your learning style preference."
    },
    {
      id: 'doubts_discipline',
      question: "When you have doubts or questions, how quickly are they typically resolved? And how would you rate your self-discipline with studies?",
      followUp: "Thank you for sharing that with me."
    }
  ];

  const tagKeywords = {
    PACE: ['slow', 'fast', 'behind', 'catch up', 'speed'],
    BATCH: ['batch', 'class size', 'large class', 'many students'],
    INTL: ['international', 'ib', 'igcse', 'abroad', 'cbse international'],
    LOST11: ['11th', 'eleventh', 'missed', 'weak foundation', 'restart'],
    PANIC: ['exam soon', 'limited time', 'urgent', 'crash course'],
    'NUM-PHY': ['physics numerical', 'physics problems', 'physics calculations'],
    'NUM-CHE': ['chemistry numerical', 'chemistry problems', 'chemistry calculations'],
    'NUM-MATH': ['math problems', 'mathematics numerical', 'math calculations'],
    'CONCEPT-PHY': ['physics concepts', 'understand physics', 'physics theory'],
    'CONCEPT-CHE': ['chemistry concepts', 'understand chemistry', 'chemistry theory'],
    'CONCEPT-MATH': ['math concepts', 'understand mathematics', 'math theory'],
    DISCIPLINE: ['discipline', 'focus', 'distraction', 'motivation'],
    DOUBTS: ['doubts', 'questions', 'clarification', 'confusion'],
    BOARD: ['board exam', 'school exam', 'cbse', 'state board'],
    DROPPER: ['dropper', 'gap year', 'repeat', 'second attempt'],
    COST: ['expensive', 'cost', 'price', 'budget', 'fees']
  };

  const pitchBlocks = {
    PACE: "I understand you need to adjust your pace. Our 1-on-1 mentorship allows us to customize the speed entirely to your learning style. We use micro-tests every week, provide recorded sessions you can review, and course-correct every 15 days based on your progress.",
    BATCH: "Unlike batch coaching where you're one of many, we provide 100% personalized 1-on-1 mentorship with IIT/NIT alumni. Every session is tailored specifically to your needs, not a generic curriculum.",
    INTL: "Perfect! We specialize in bridging international curricula like IB to IIT preparation. We focus on quick-win 11th topics, provide numerical practice packs, and help you adapt to the test tempo needed for JEE.",
    LOST11: "No worries - we have a compressed 11th + 12th synchronization program. We skip low-ROI topics and create a realistic 6-month plan that covers what you truly need for JEE success.",
    PANIC: "Given your time constraint, I recommend our crash pack of 30-40 hours with strict milestones and weekly progress reviews. We focus only on high-impact topics that maximize your score potential.",
    'NUM-PHY': "Our Numerical Pack for Physics includes past-paper drills, error-log tracking, and questions-per-minute improvement strategies. You'll see dramatic improvement in your problem-solving speed.",
    'NUM-CHE': "For Chemistry numericals, we have specialized drills that cover all major calculation types with timed practice sessions and error pattern analysis.",
    'NUM-MATH': "Our Math numerical pack focuses on speed and accuracy with systematic practice of all JEE problem types, including time management techniques.",
    'CONCEPT-PHY': "Our Full-Solver Track rebuilds Physics concepts from the ground up, then systematically applies them to solve complex problems. You'll develop true understanding, not just memorization.",
    'CONCEPT-CHE': "We'll rebuild your Chemistry foundation with concept clarity sessions followed by graduated problem-solving practice until you achieve mastery.",
    'CONCEPT-MATH': "Our approach ensures you understand the 'why' behind Math concepts before moving to application, creating a solid foundation for complex JEE problems.",
    DISCIPLINE: "We provide daily WhatsApp check-ins, micro-tests to maintain momentum, unlimited doubt resolution, and live monitoring during sessions with cameras on for accountability.",
    DOUBTS: "You'll have unlimited doubt resolution with immediate responses, live monitoring during sessions, and direct access to your mentor for clarifications.",
    BOARD: "We ensure perfect alignment between Board exam preparation and JEE, plus we help develop the test temperament needed for both.",
    DROPPER: "As a dropper, you need focused preparation. Our crash pack with strict milestones and weekly reviews ensures you make the most of your preparation year.",
    COST: "Our pricing reflects the complete value bundle - it's not just per-hour tutoring, but includes personalized roadmaps, materials, tracking, guarantees, and ongoing support. We offer three guarantees to ensure your success."
  };

  const objectionResponses = {
    price: "I understand cost is a consideration. Remember, this isn't just hourly tutoring - it's 1-on-1 IIT mentorship plus personalized roadmap, progress tracking, materials, and our triple guarantee. The investment pays for itself with the results.",
    existing_coaching: "That's actually perfect - we can run parallel mentorship alongside your current coaching. While they provide batch teaching, we personalize everything specifically for your needs and gaps.",
    online_concerns: "Many of our students who achieved AIR under 500 studied online. We monitor live sessions, provide recorded replays for review, and offer instant doubt resolution. The results speak for themselves.",
    time_constraints: "Our roadmap prioritizes quick-wins and fixes numerical leaks first. We skip low-ROI topics and focus on what will improve your score fastest.",
    comparison_shopping: "I understand you want to make the right choice. Let's do a neutral assessment this week - we'll show you exactly where you stand and what improvement is possible."
  };

  // Helper functions
  const detectTags = (text) => {
    const detected = [];
    const lowerText = text.toLowerCase();
    
    Object.entries(tagKeywords).forEach(([tag, keywords]) => {
      if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
        detected.push(tag);
      }
    });
    
    return detected;
  };

  const generatePitchResponse = (tags) => {
    let response = "Thank you so much for being so open with me about your JEE journey. Based on everything you've shared, I can already see some specific ways our program could really make a difference for you. ";
    
    const relevantTags = [...new Set([...detectedTags, ...tags])].slice(0, 3);
    
    relevantTags.forEach(tag => {
      if (pitchBlocks[tag]) {
        response += pitchBlocks[tag] + " ";
      }
    });
    
    response += "What makes me really confident about this is our Triple Guarantee - we guarantee score improvement, mentor satisfaction, and if you're not completely happy, we'll refund your investment. I'd love to offer you a completely free assessment where one of our IIT mentors can evaluate exactly where you stand and create a personalized roadmap just for you. Would that be something you'd be interested in exploring?";
    
    return response;
  };

  const handlePitchPhaseResponse = (userMessage, tags) => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('expensive') || lowerMessage.includes('cost') || lowerMessage.includes('price') || lowerMessage.includes('afford')) {
      return "I totally understand that investment is an important consideration for any family. Let me put this in perspective for you - " + objectionResponses.price + " Plus, remember we have that money-back guarantee, so there's really no risk to you.";
    } else if (lowerMessage.includes('already') && (lowerMessage.includes('coaching') || lowerMessage.includes('tuition'))) {
      return "Oh, that's actually fantastic that you're already working with a coaching institute! " + objectionResponses.existing_coaching + " Many of our most successful students actually came to us while they were still in other programs.";
    } else if (lowerMessage.includes('online') && (lowerMessage.includes('don\'t') || lowerMessage.includes('won\'t work'))) {
      return "You know, I hear that concern quite often, and I completely understand why you might feel that way. " + objectionResponses.online_concerns + " Would you be open to trying just one session to see how it feels?";
    } else if (lowerMessage.includes('time') && lowerMessage.includes('less')) {
      return "Time pressure is so real, especially for JEE preparation. " + objectionResponses.time_constraints + " The assessment would actually help us create a timeline that maximizes your limited time.";
    } else if (lowerMessage.includes('think about') || lowerMessage.includes('discuss') || lowerMessage.includes('parents')) {
      return "Absolutely! That's a smart approach, and I'd expect nothing less from a future IIT student. Taking time to discuss with your parents shows great maturity. The free assessment doesn't require any commitment, so you could experience what we offer and then have a much more informed discussion with your family. Does that sound reasonable?";
    } else if (lowerMessage.includes('yes') || lowerMessage.includes('interested') || lowerMessage.includes('sure') || lowerMessage.includes('okay')) {
      setConversationPhase('close');
      return "That's wonderful! I'm so excited for you. Here's what happens next: I'll connect you with one of our senior IIT mentors who will spend about 60 minutes with you. They'll assess your current level across Physics, Chemistry, and Math, identify exactly where your biggest opportunities are, and create a personalized roadmap that's tailored specifically to your goals and timeline. After the session, you'll receive a detailed report that will be valuable regardless of what you decide. When would be a good time for you this week?";
    } else if (lowerMessage.includes('no') || lowerMessage.includes('not sure')) {
      return "No worries at all! I don't want you to feel any pressure. Can I ask what's making you hesitate? Is there something specific you'd like to know more about, or is there a particular concern I could address for you?";
    }
    
    return "I hear you, and I want to make sure I'm addressing what's most important to you. " + generatePitchResponse(tags);
  };

  const getNextResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('stop') || lowerMessage.includes('end') || lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
      return "I understand you'd like to end our conversation. Thank you so much for your time today! If you change your mind and want to explore how iiTuitions can help you ace the JEE, please don't hesitate to reach out. Have a wonderful day, and best of luck with your studies!";
    }
    
    if (lowerMessage.includes('not interested') || lowerMessage.includes('no thanks') || lowerMessage.includes('don\'t want')) {
      return "I completely understand, and I appreciate your honesty! There's no pressure at all. If you ever have questions about JEE preparation or want to chat about your study goals, I'm here. Take care!";
    }
    
    const newTags = detectTags(userMessage);
    setDetectedTags(prev => [...new Set([...prev, ...newTags])]);
    
    if (conversationPhase === 'getting_to_know') {
      setConversationPhase('triage');
      return `That's great to hear! I'm really glad we connected today. Now, I'd love to learn more about your JEE journey so I can understand exactly how we might be able to help you. ${triageQuestions[0].question}`;
    } else if (conversationPhase === 'triage') {
      const currentQuestion = triageQuestions[currentQuestionIndex];
      setUserAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: userMessage
      }));
      
      let naturalResponse = "";
      
      if (currentQuestionIndex === 0) {
        if (lowerMessage.includes('11th') || lowerMessage.includes('eleventh')) {
          naturalResponse = "Perfect! 11th grade is such an important year for building your foundation. ";
        } else if (lowerMessage.includes('12th') || lowerMessage.includes('twelfth')) {
          naturalResponse = "Great! 12th grade - this is where everything comes together. ";
        }
      } else if (currentQuestionIndex === 2) {
        naturalResponse = "I really appreciate you sharing that with me. That sounds challenging, and you're definitely not alone in feeling that way. ";
      }
      
      if (currentQuestionIndex < triageQuestions.length - 1) {
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        return `${naturalResponse}${triageQuestions[nextIndex].question}`;
      } else {
        setConversationPhase('pitch');
        return naturalResponse + generatePitchResponse(newTags);
      }
    } else if (conversationPhase === 'pitch') {
      return handlePitchPhaseResponse(userMessage, newTags);
    }
    
    return "I really appreciate you sharing that with me. Is there anything specific about JEE preparation you'd like to discuss today?";
  };

  const handleStopCommand = () => {
    console.log('Stop command detected');
    setIsInterrupted(true);
    
    if (currentUtteranceRef.current) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    
    setTimeout(() => {
      const stopResponse = "I understand you'd like me to pause. I'm here and ready to continue whenever you are. What would you like to talk about?";
      handleAIResponse(stopResponse);
    }, 500);
  };

  const handleUserSpeech = (transcript) => {
    if (!transcript.trim()) return;
    
    setConversation(prev => [...prev, {
      type: 'user',
      message: transcript,
      timestamp: new Date().toLocaleTimeString()
    }]);
    
    setIsProcessing(true);
    setTimeout(() => {
      const response = getNextResponse(transcript);
      handleAIResponse(response);
    }, 1000);
  };

  const handleAIResponse = (responseText) => {
    setIsProcessing(false);
    setIsSpeaking(true);
    
    setConversation(prev => [...prev, {
      type: 'assistant',
      message: responseText,
      timestamp: new Date().toLocaleTimeString()
    }]);
    
    try {
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(responseText);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      currentUtteranceRef.current = utterance;
      
      utterance.onstart = () => {
        console.log('AI speech started');
        setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        console.log('AI speech ended');
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        
        if (isConnected && !isInterrupted) {
          setIsListening(true);
        }
      };
      
      utterance.onerror = (error) => {
        console.error('Speech error:', error);
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        
        if (isConnected && !isInterrupted) {
          setIsListening(true);
        }
      };
      
      setTimeout(() => {
        if (!isInterrupted) {
          speechSynthesis.speak(utterance);
        }
      }, 100);
      
    } catch (error) {
      console.error('Text-to-speech error:', error);
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
    }
  };

  const startListening = async () => {
    try {
      setIsInterrupted(false);
      
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
        speechRecognitionRef.current = new SpeechRecognition();
        speechRecognitionRef.current.continuous = true;
        speechRecognitionRef.current.interimResults = true;
        speechRecognitionRef.current.lang = 'en-US';
        
        speechRecognitionRef.current.onstart = () => {
          setIsListening(true);
          console.log('Speech recognition started');
        };
        
        speechRecognitionRef.current.onresult = (event) => {
          let finalTranscript = '';
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          const currentTranscript = (finalTranscript + interimTranscript).toLowerCase();
          if (currentTranscript.includes('stop') || currentTranscript.includes('hold on') || currentTranscript.includes('wait')) {
            if (isSpeaking) {
              handleStopCommand();
            }
          }
          
          if (finalTranscript) {
            setTranscript(finalTranscript);
            handleUserSpeech(finalTranscript);
          } else {
            setTranscript(interimTranscript);
          }
        };
        
        speechRecognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          if (event.error !== 'no-speech') {
            setTimeout(() => {
              if (isConnected && !isInterrupted) {
                startListening();
              }
            }, 1000);
          }
        };
        
        speechRecognitionRef.current.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
          if (isConnected && !isInterrupted) {
            setTimeout(() => {
              startListening();
            }, 500);
          }
        };
        
        speechRecognitionRef.current.start();
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          } 
        });
        
        audioStreamRef.current = stream;
        setIsListening(true);
        
        setTimeout(() => {
          const mockResponses = [
            "I'm in 11th grade and planning to take JEE in 2026",
            "I'm at FIITJEE coaching and we have tests every week",
            "My biggest frustration is that I can't solve Physics numericals quickly",
            "I understand concepts well but struggle with numerical problems in all subjects",
            "I prefer a moderate pace, not too fast but not too slow",
            "My doubts take 2-3 days to get resolved and I sometimes lack discipline",
            "Yes, I'm interested in the assessment"
          ];
          
          let mockUserMessage = "Good, thank you for asking! I'm ready to learn about iiTuitions.";
          if (conversationPhase === 'triage' && currentQuestionIndex < mockResponses.length) {
            mockUserMessage = mockResponses[currentQuestionIndex];
          }
          
          setTranscript(mockUserMessage);
          handleUserSpeech(mockUserMessage);
        }, 2000);
      }
      
    } catch (error) {
      console.error('Microphone access denied:', error);
      setTimeout(() => {
        const mockUserMessage = "Good, thank you! I'm ready to learn about your program.";
        setTranscript(mockUserMessage);
        handleUserSpeech(mockUserMessage);
      }, 1000);
    }
  };

  const stopListening = () => {
    setIsInterrupted(true);
    setIsListening(false);
    
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        audioContextRef.current = null;
      });
    }
  };

  const connectToOpenAI = async () => {
    try {
      setConnectionStatus('Connecting...');
      
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: (data) => {
          console.log('Sending to OpenAI:', data);
        },
        close: () => {
          setIsConnected(false);
          setConnectionStatus('Disconnected');
        }
      };
      
      wsRef.current = mockWs;
      setIsConnected(true);
      setConnectionStatus('Connected');
      setConversationPhase('welcome');
      setIsInterrupted(false);
      
      setConversation([{
        type: 'assistant',
        message: 'Voice assistant connected. Starting consultation...',
        timestamp: new Date().toLocaleTimeString()
      }]);
      
      setTimeout(() => {
        startListening();
      }, 1000);
      
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionStatus('Connection Failed');
    }
  };

  const disconnectFromOpenAI = () => {
    setIsInterrupted(true);
    
    if (currentUtteranceRef.current) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    stopListening();
    setIsConnected(false);
    setConnectionStatus('Disconnected');
    
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setDetectedTags([]);
    setConversationPhase('welcome');
    setTranscript('');
  };

  // Conversation flow management
  useEffect(() => {
    if (conversationPhase === 'welcome' && isConnected) {
      setTimeout(() => {
        const now = new Date();
        const hour = now.getHours();
        let greeting;
        
        if (hour < 12) {
          greeting = "Good morning!";
        } else if (hour < 17) {
          greeting = "Good afternoon!";
        } else {
          greeting = "Good evening!";
        }
        
        const welcomeMessage = `${greeting} Welcome to iiTuitions! I'm excited to speak with you today. My name is Priya, and I'm here to help you achieve your IIT-JEE dreams through our personalized mentorship program. Before we dive into how we can help you, I'd love to get to know you better. How are you doing today?`;
        handleAIResponse(welcomeMessage);
        setConversationPhase('getting_to_know');
      }, 1000);
    }
  }, [conversationPhase, isConnected]);

  const getStatusColor = () => {
    if (isListening) return 'bg-red-500';
    if (isProcessing) return 'bg-yellow-500';
    if (isSpeaking) return 'bg-blue-500';
    if (isConnected) return 'bg-green-500';
    return 'bg-gray-500';
  };

  const getStatusText = () => {
    if (isListening) return 'Listening...';
    if (isProcessing) return 'Processing...';
    if (isSpeaking) return 'Speaking...';
    if (isConnected) return `Ready to talk - ${conversationPhase}`;
    return connectionStatus;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">iiTuitions - IIT JEE Consultation</h1>
          <p className="text-gray-600">Personalized 1-on-1 Mentorship by IIT/NIT Alumni</p>
        </div>

        {isConnected && (
          <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <FileText size={20} className="text-blue-600" />
                <span className="font-medium">Phase: {conversationPhase.charAt(0).toUpperCase() + conversationPhase.slice(1)}</span>
                {conversationPhase === 'triage' && (
                  <span className="text-sm text-gray-600">Question {currentQuestionIndex + 1} of {triageQuestions.length}</span>
                )}
              </div>
              {detectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detectedTags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-center mb-6">
            <div className={`w-4 h-4 rounded-full ${getStatusColor()} mr-3`}></div>
            <span className="text-lg font-medium text-gray-700">{getStatusText()}</span>
          </div>

          <div className="flex justify-center space-x-4 mb-8">
            {!isConnected ? (
              <button
                onClick={connectToOpenAI}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
              >
                <Phone size={20} />
                <span>Start Consultation</span>
              </button>
            ) : (
              <>
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing || isSpeaking}
                  className={`${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-blue-500 hover:bg-blue-600'
                  } disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors`}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  <span>{isListening ? 'Stop Talking' : 'Start Talking'}</span>
                </button>
                
                <button
                  onClick={disconnectFromOpenAI}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <PhoneOff size={20} />
                  <span>End Session</span>
                </button>
              </>
            )}
          </div>

          {transcript && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-800 mb-2">Your Response:</h3>
              <p className="text-blue-700">{transcript}</p>
            </div>
          )}
        </div>

        {conversation.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <MessageCircle className="mr-2" size={24} />
              Consultation Transcript
            </h2>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {conversation.map((msg, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg ${
                    msg.type === 'user' 
                      ? 'bg-blue-100 ml-8' 
                      : 'bg-gray-100 mr-8'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-medium ${
                      msg.type === 'user' ? 'text-blue-800' : 'text-gray-800'
                    }`}>
                      {msg.type === 'user' ? 'You' : 'iiTuitions Counselor'}
                    </span>
                    <span className="text-xs text-gray-500">{msg.timestamp}</span>
                  </div>
                  <p className="text-gray-700">{msg.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-800 mb-2">iiTuitions Program Highlights:</h3>
          <ul className="text-blue-700 space-y-1">
            <li>• 100% 1-on-1 mentorship by IIT/NIT alumni</li>
            <li>• Personalized roadmaps and daily WhatsApp updates</li>
            <li>• Course corrections every 15 days</li>
            <li>• Recorded sessions for review</li>
            <li>• Triple Guarantee (Score, Satisfaction, Money-back)</li>
            <li>• Limited intake: 50 students per year</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
