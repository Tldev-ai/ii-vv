import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, MessageCircle, Phone, PhoneOff } from 'lucide-react';

const VoiceAssistant = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState([]);
  const wsRef = useRef(null);
  const currentUtteranceRef = useRef(null);

  const connectToOpenAI = async () => {
    try {
      setConnectionStatus('Connecting...');
      
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: (data) => {
          console.log('Sending to AI:', data);
        },
        close: () => {
          setIsConnected(false);
          setConnectionStatus('Disconnected');
        }
      };
      
      wsRef.current = mockWs;
      setIsConnected(true);
      setConnectionStatus('Connected');
      
      // Welcome message
      setConversation([{
        type: 'assistant',
        message: 'Hello! Welcome to iiTuitions. I\'m here to help you find the perfect tutoring for your IIT-JEE preparation. What are you looking for today?',
        timestamp: new Date().toLocaleTimeString()
      }]);

      // Start speaking welcome message
      setTimeout(() => {
        const now = new Date();
        const hour = now.getHours();
        let greeting = hour < 12 ? "Good morning!" : hour < 17 ? "Good afternoon!" : "Good evening!";
        
        const welcomeMessage = `${greeting} Welcome to iiTuitions! I'm here to help you with your IIT-JEE preparation. We offer personalized 1-on-1 mentorship by IIT and NIT alumni. What would you like to know about our program?`;
        
        handleAIResponse(welcomeMessage);
      }, 1000);
      
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionStatus('Connection Failed');
    }
  };

  const disconnectFromOpenAI = () => {
    // Stop any ongoing speech
    if (currentUtteranceRef.current) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setIsConnected(false);
    setConnectionStatus('Disconnected');
    setTranscript('');
    setIsListening(false);
    setIsProcessing(false);
  };

  const startListening = async () => {
    try {
      setIsListening(true);
      
      // Add user message showing we're listening
      setConversation(prev => [...prev, {
        type: 'user',
        message: 'Listening...',
        timestamp: new Date().toLocaleTimeString()
      }]);
      
      // Simulate voice input after 3 seconds
      setTimeout(() => {
        const mockUserMessages = [
          "What programs do you offer?",
          "How much does it cost?", 
          "I need help with Physics",
          "Tell me about your mentors",
          "I'm in 12th grade preparing for JEE",
          "What's your success rate?",
          "I am looking for a tuition for him"
        ];
        
        const randomMessage = mockUserMessages[Math.floor(Math.random() * mockUserMessages.length)];
        setTranscript(randomMessage);
        
        // Update the listening message with actual response
        setConversation(prev => {
          const newConv = [...prev];
          newConv[newConv.length - 1].message = randomMessage;
          return newConv;
        });
        
        setIsListening(false);
        processUserInput(randomMessage);
      }, 3000);
      
    } catch (error) {
      console.error('Error:', error);
      setIsListening(false);
    }
  };

  const processUserInput = (message) => {
    setIsProcessing(true);
    
    setTimeout(() => {
      const response = generateResponse(message);
      handleAIResponse(response);
    }, 1500);
  };

  const generateResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Handle stop commands
    if (lowerMessage.includes('stop') || lowerMessage.includes('enough') || lowerMessage.includes('quiet')) {
      return "I'll stop talking now. Just let me know when you'd like to continue our conversation!";
    }
    
    // Friendly responses about iiTuitions
    if (lowerMessage.includes('program') || lowerMessage.includes('offer') || lowerMessage.includes('service')) {
      return "We offer personalized 1-on-1 mentorship for IIT-JEE preparation. Our mentors are IIT and NIT alumni who provide customized study plans, daily progress tracking, and unlimited doubt clearing. Each student gets a dedicated mentor who understands their unique learning style.";
    }
    
    if (lowerMessage.includes('cost') || lowerMessage.includes('price') || lowerMessage.includes('fee')) {
      return "Our fees depend on the program you choose. We have different packages for Mains and Advanced preparation. The investment ranges from 800 to 1500 rupees per hour, but we also offer package deals with significant discounts. Would you like me to connect you with our counselor for detailed pricing?";
    }
    
    if (lowerMessage.includes('physics') || lowerMessage.includes('chemistry') || lowerMessage.includes('math')) {
      return "Subject-specific help is our specialty! Our mentors are experts in Physics, Chemistry, and Mathematics. We focus on both concept clarity and problem-solving techniques. We also provide numerical practice packs and regular assessments to track your progress.";
    }
    
    if (lowerMessage.includes('mentor') || lowerMessage.includes('teacher')) {
      return "All our mentors are IIT and NIT graduates with proven track records. They provide 1-on-1 personalized attention, which means the teaching pace and style is completely adapted to your needs. You'll have direct access to your mentor for doubts and guidance.";
    }
    
    if (lowerMessage.includes('12th') || lowerMessage.includes('11th') || lowerMessage.includes('grade')) {
      return "Perfect! We have specialized programs for both 11th and 12th grade students. For 12th graders, we focus on intensive JEE preparation with crash courses if needed. For 11th graders, we build a strong foundation while keeping pace with the syllabus.";
    }
    
    if (lowerMessage.includes('success') || lowerMessage.includes('result')) {
      return "We're proud of our results! Many of our students have secured ranks under AIR 500, and our success rate for JEE qualification is over 85%. We provide a score improvement guarantee - if you don't see improvement, we refund your fees.";
    }
    
    if (lowerMessage.includes('tuition') || lowerMessage.includes('looking for')) {
      return "That's wonderful! Finding the right tuition is crucial for JEE success. At iiTuitions, we don't just teach - we mentor. Could you tell me a bit more about what you're looking for? Which grade is the student in, and what are the main challenges they're facing?";
    }
    
    // Default friendly response
    return "That sounds interesting! At iiTuitions, we specialize in personalized IIT-JEE coaching with 1-on-1 mentorship. Our IIT and NIT alumni mentors provide customized guidance based on each student's needs. Would you like to know more about any specific aspect of our program?";
  };

  const handleAIResponse = (responseText) => {
    setIsProcessing(false);
    setIsSpeaking(true);
    
    // Add AI response to conversation
    setConversation(prev => [...prev, {
      type: 'assistant',
      message: responseText,
      timestamp: new Date().toLocaleTimeString()
    }]);
    
    // Speak the response
    try {
      speechSynthesis.cancel(); // Stop any ongoing speech
      
      const utterance = new SpeechSynthesisUtterance(responseText);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      currentUtteranceRef.current = utterance;
      
      utterance.onend = () => {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
      };
      
      utterance.onerror = (error) => {
        console.error('Speech error:', error);
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
      };
      
      speechSynthesis.speak(utterance);
      
    } catch (error) {
      console.error('Text-to-speech error:', error);
      setIsSpeaking(false);
    }
  };

  // Stop speaking when user says stop
  useEffect(() => {
    if (transcript.toLowerCase().includes('stop') && isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      
      // Add a brief acknowledgment
      setTimeout(() => {
        handleAIResponse("Sure, I've stopped. What would you like to know?");
      }, 500);
    }
  }, [transcript, isSpeaking]);

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
    if (isConnected) return 'Ready to help';
    return connectionStatus;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">iiTuitions Assistant</h1>
          <p className="text-gray-600">Your friendly guide to IIT-JEE success</p>
        </div>

        {/* Main Interface */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          {/* Status Indicator */}
          <div className="flex items-center justify-center mb-6">
            <div className={`w-4 h-4 rounded-full ${getStatusColor()} mr-3`}></div>
            <span className="text-lg font-medium text-gray-700">{getStatusText()}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex justify-center space-x-4 mb-8">
            {!isConnected ? (
              <button
                onClick={connectToOpenAI}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
              >
                <Phone size={20} />
                <span>Start Chat</span>
              </button>
            ) : (
              <>
                <button
                  onClick={startListening}
                  disabled={isProcessing || isSpeaking || isListening}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <Mic size={20} />
                  <span>Ask Question</span>
                </button>
                
                <button
                  onClick={() => {
                    if (isSpeaking) {
                      speechSynthesis.cancel();
                      setIsSpeaking(false);
                      currentUtteranceRef.current = null;
                    }
                  }}
                  disabled={!isSpeaking}
                  className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <MicOff size={20} />
                  <span>Stop</span>
                </button>
                
                <button
                  onClick={disconnectFromOpenAI}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <PhoneOff size={20} />
                  <span>End Chat</span>
                </button>
              </>
            )}
          </div>

          {/* Live Transcript */}
          {transcript && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-800 mb-2">You said:</h3>
              <p className="text-blue-700">{transcript}</p>
            </div>
          )}
        </div>

        {/* Conversation History */}
        {conversation.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <MessageCircle className="mr-2" size={24} />
              Conversation
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

        {/* Quick Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-800 mb-2">About iiTuitions:</h3>
          <p className="text-blue-700">
            Personalized 1-on-1 IIT-JEE mentorship by IIT/NIT alumni. 
            Ask me about our programs, pricing, mentors, or anything else!
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
