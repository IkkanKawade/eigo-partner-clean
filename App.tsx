import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { Message, SpeechRecognitionStatus } from './types';
import ChatMessageItem from './components/ChatMessageItem';
import { MicrophoneIcon, StopIcon, SendIcon, BotIcon, EigoPartnerLogoIcon } from './components/Icons';

const API_KEY = import.meta.env.VITE_API_KEY;

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [isWaitingForAI, setIsWaitingForAI] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [speechRecognitionStatus, setSpeechRecognitionStatus] = useState<SpeechRecognitionStatus>('idle');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const systemInstruction = `You are Kai, a friendly and patient English conversation partner for Japanese beginners. Your goal is to help them practice speaking in a relaxed environment.
- Keep your responses simple, clear, and encouraging. Use short sentences.
- Ask natural follow-up questions to keep the conversation flowing.
- If the user makes a small grammatical mistake, gently incorporate the correct form in your response or offer a subtle correction. Focus on building their confidence and fluency, not on being overly critical.
- Be positive and supportive.
- Your responses should be in English.
- Do not use any emojis in your responses.`;

  useEffect(() => {
    if (!API_KEY) {
      setError("API key is missing. Please set the VITE_API_KEY environment variable.");
      return;
    }

    const initializeChat = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const newChat = ai.chats.create({
          model: 'gemini-2.5-flash-preview-04-17',
          config: { systemInstruction },
        });
        setChat(newChat);

        setMessages([{
          id: 'kai-intro',
          text: "Welcome to Eigo Partner! I'm Kai, your AI English conversation partner. Ready to chat and improve your English? What's on your mind?",
          sender: 'ai',
          timestamp: Date.now()
        }]);
        setIsWaitingForAI(false);

      } catch (err) {
        console.error("Failed to initialize chat:", err);
        setError("Could not connect to the AI. Please check your API key and network connection.");
        setIsWaitingForAI(false);
      }
    };

    initializeChat();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const handleSpeechResult = useCallback((event: SpeechRecognitionEvent) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    setCurrentTranscript(prev => prev + transcript);

    if (event.results[event.results.length - 1].isFinal) {
      const finalTranscript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setCurrentTranscript(finalTranscript.trim());
    }
  }, []);

  const handleSpeechError = useCallback((event: SpeechRecognitionErrorEvent) => {
    console.error('Speech recognition error:', event.error);
    let errorMessage = 'Speech recognition error.';
    if (event.error === 'no-speech') {
      errorMessage = 'No speech detected. Please try again.';
    } else if (event.error === 'audio-capture') {
      errorMessage = 'Microphone problem. Please check your microphone.';
    } else if (event.error === 'not-allowed') {
      errorMessage = 'Microphone access denied. Please enable microphone permissions in your browser settings.';
    }
    setError(errorMessage);
    setSpeechRecognitionStatus('error');
    setCurrentTranscript('');
  }, []);

  const startRecording = useCallback(() => {
    if (speechRecognitionStatus === 'listening' || isWaitingForAI) return;

    const BrowserSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!BrowserSpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      setSpeechRecognitionStatus('error');
      return;
    }

    setError(null);
    setCurrentTranscript('');

    if (!recognitionRef.current) {
      recognitionRef.current = new BrowserSpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = handleSpeechResult;
      recognitionRef.current.onerror = handleSpeechError;
      recognitionRef.current.onend = () => {
        setSpeechRecognitionStatus(current => current === 'listening' ? 'idle' : current);
      };
    }

    try {
      recognitionRef.current.start();
      setSpeechRecognitionStatus('listening');
    } catch (e) {
      console.error("Error starting speech recognition:", e);
      setError("Could not start microphone. Please check permissions.");
      setSpeechRecognitionStatus('error');
    }
  }, [speechRecognitionStatus, isWaitingForAI, handleSpeechResult, handleSpeechError]);

  const stopRecordingAndProcess = useCallback(async () => {
    const trimmedTranscript = currentTranscript.trim();

    if (speechRecognitionStatus !== 'listening' && !trimmedTranscript) {
      setError("Please type a message or try speaking.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (speechRecognitionStatus === 'listening' && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setSpeechRecognitionStatus('processing');
    setIsWaitingForAI(true);

    const userMessageText = trimmedTranscript;

    if (!userMessageText) {
      setSpeechRecognitionStatus('idle');
      setCurrentTranscript('');
      setIsWaitingForAI(false);
      setError("No speech was detected or your message was empty.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      text: userMessageText,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    setCurrentTranscript('');

    if (chat) {
      try {
        const response = await chat.sendMessage({ message: userMessageText });
        const aiResponseText = response.text;

        const newAiMessage: Message = {
          id: `ai-${Date.now()}`,
          text: aiResponseText,
          sender: 'ai',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, newAiMessage]);
        speak(aiResponseText);
      } catch (err) {
        console.error("Error sending message to AI:", err);
        setError("Sorry, I couldn't get a response. Please try again.");
        const errorAiMessage: Message = {
          id: `ai-error-${Date.now()}`,
          text: "I'm having a little trouble responding right now. Could you try that again?",
          sender: 'ai',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorAiMessage]);
      } finally {
        setIsWaitingForAI(false);
        setSpeechRecognitionStatus('idle');
      }
    } else {
      setError("Chat not initialized.");
      setIsWaitingForAI(false);
      setSpeechRecognitionStatus('idle');
    }
  }, [chat, currentTranscript, speak, speechRecognitionStatus]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  if (!API_KEY && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-100 text-red-700 p-8">
        <h1 className="text-2xl font-bold mb-4">Configuration Error</h1>
        <p className="text-center">VITE_API_KEY is not configured. This application cannot function without it.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-white shadow-xl">
      <header className="bg-primary text-white p-4 flex items-center justify-between shadow-md">
        <div className="flex items-center">
          <EigoPartnerLogoIcon className="w-10 h-10 mr-3" />
          <h1 className="text-xl font-semibold">Eigo Partner</h1>
        </div>
        <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-xs opacity-75 hover:opacity-100">
          Powered by Gemini
        </a>
      </header>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-4 rounded shadow-md" role="alert">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700 font-bold text-2xl leading-none">&times;</button>
          </div>
        </div>
      )}

      <div ref={chatContainerRef} className="flex-grow p-6 space-y-4 overflow-y-auto bg-lightgray">
        {messages.map(msg => (
          <ChatMessageItem key={msg.id} message={msg} />
        ))}
        {isWaitingForAI && messages[messages.length - 1]?.sender === 'user' && (
          <div className="flex justify-start mb-4">
            <div className="flex items-end max-w-xl flex-row">
              <div className="p-1 rounded-full bg-secondary mr-2 text-white flex-shrink-0">
                <BotIcon className="w-5 h-5" />
              </div>
              <div className="px-4 py-3 rounded-xl shadow-md bg-white text-gray-800 rounded-bl-none">
                <p className="text-sm italic">Kai is thinking...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-4 border-t border-mediumgray shadow-top">
        {speechRecognitionStatus === 'listening' && (
          <div className="mb-2 p-3 bg-gray-100 rounded-lg text-sm text-gray-700 min-h-[40px] border border-gray-300">
            {currentTranscript || <span className="italic text-gray-500">Listening... Say something.</span>}
          </div>
        )}

        <div className="flex items-center space-x-3">
          {speechRecognitionStatus !== 'listening' ? (
            <button
              onClick={startRecording}
              disabled={isWaitingForAI || !chat || speechRecognitionStatus === 'processing'}
              className={`p-3 rounded-full text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary
                ${isWaitingForAI || !chat || speechRecognitionStatus === 'processing' ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-blue-700'}`}
              aria-label="Start recording"
            >
              <MicrophoneIcon className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={stopRecordingAndProcess}
              className="p-3 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 animate-pulse"
              aria-label="Stop recording and send"
            >
              <StopIcon className="w-6 h-6" />
            </button>
          )}

          <input
            type="text"
            value={currentTranscript}
            onChange={(e) => setCurrentTranscript(e.target.value)}
            placeholder={speechRecognitionStatus === 'listening' ? "Voice input active..." : "Or type your message..."}
            className="flex-grow p-3 border border-mediumgray rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow"
            disabled={speechRecognitionStatus === 'listening' || isWaitingForAI}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && currentTranscript.trim() && speechRecognitionStatus !== 'listening' && !isWaitingForAI) {
                stopRecordingAndProcess();
              }
            }}
          />

          <button
            onClick={stopRecordingAndProcess}
            disabled={!currentTranscript.trim() || isWaitingForAI || speechRecognitionStatus === 'listening'}
            className={`p-3 rounded-full text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary
              ${!currentTranscript.trim() || isWaitingForAI || speechRecognitionStatus === 'listening' ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-blue-700'}`}
            aria-label="Send message"
          >
            <SendIcon className="w-6 h-6" />
          </button>
        </div>
        {speechRecognitionStatus === 'error' && currentTranscript && (
          <p className="text-xs text-red-500 mt-1">There was an issue with recording. Your typed text: "{currentTranscript}" can still be sent.</p>
        )}
      </div>
    </div>
  );
};

export default App;
