import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, MicOff, Volume2, VolumeX } from 'lucide-react';

export interface Message {
  role: 'ai' | 'user';
  text: string;
}

interface ChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isVoiceMode: boolean;
  isProcessing: boolean;
}

export default function Chat({ messages, onSendMessage, isVoiceMode, isProcessing }: ChatProps) {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isVoiceMode && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onSendMessage(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [isVoiceMode, onSendMessage]);

  const lastSpokenIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (isVoiceMode && messages.length > 0) {
      const lastIndex = messages.length - 1;
      const lastMessage = messages[lastIndex];
      if (lastMessage.role === 'ai' && lastSpokenIndexRef.current !== lastIndex) {
        lastSpokenIndexRef.current = lastIndex;
        speak(lastMessage.text);
      }
    }
  }, [messages, isVoiceMode]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-2xl ${
                msg.role === 'ai'
                  ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
                  : 'bg-indigo-600 text-white rounded-tr-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white text-slate-500 border border-slate-200 p-3 rounded-2xl rounded-tl-sm flex items-center space-x-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        {isVoiceMode ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="flex items-center space-x-4">
              {isSpeaking && (
                <div className="flex items-center text-indigo-600 text-sm">
                  <Volume2 className="w-4 h-4 mr-2 animate-pulse" />
                  AI is speaking...
                </div>
              )}
            </div>
            <button
              onClick={toggleListening}
              disabled={isProcessing || isSpeaking}
              className={`p-6 rounded-full transition-all duration-300 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 scale-110'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
            <p className="text-sm text-slate-500">
              {isListening ? 'Listening... Tap to stop' : 'Tap to speak'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
