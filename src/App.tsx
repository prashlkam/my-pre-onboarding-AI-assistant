import React, { useState, useEffect } from 'react';
import Chat, { Message } from './components/Chat';
import { extractIdentity, evaluateInstructionResponse, evaluateChecklistResponse } from './services/geminiService';
import { Bot, CheckCircle2, UserCircle2, ClipboardList, FileText, Send, Download } from 'lucide-react';
import { generateWordDocument } from './utils/wordGenerator';

type State = 0 | 1 | 2 | 3 | 4 | 5;

interface ChecklistItem {
  item: string;
  guidance: string;
}

interface UserData {
  name: string;
  role: string;
  instructionExceptions: { instruction: string; reason: string }[];
  completedTasks: ChecklistItem[];
  pendingTasks: ChecklistItem[];
}

export default function App() {
  const [currentState, setCurrentState] = useState<State>(0);
  const [isVoiceMode, setIsVoiceMode] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [instructions, setInstructions] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [currentChecklistIndex, setCurrentChecklistIndex] = useState(0);

  const [userData, setUserData] = useState<UserData>({
    name: '',
    role: '',
    instructionExceptions: [],
    completedTasks: [],
    pendingTasks: [],
  });

  // Load files on mount
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const instRes = await fetch('/instructions.txt');
        const instText = await instRes.text();
        const parsedInstructions = instText
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^\d+\.\s*/, '').trim());
        setInstructions(parsedInstructions);

        const checkRes = await fetch('/checklist.txt');
        const checkText = await checkRes.text();
        const parsedChecklist: ChecklistItem[] = [];
        
        const blocks = checkText.split('\n\n');
        for (const block of blocks) {
          const lines = block.split('\n');
          let item = '';
          let guidance = '';
          for (const line of lines) {
            if (line.startsWith('ITEM:')) item = line.replace('ITEM:', '').trim();
            if (line.startsWith('GUIDANCE:')) guidance = line.replace('GUIDANCE:', '').trim();
          }
          if (item && guidance) {
            parsedChecklist.push({ item, guidance });
          }
        }
        setChecklist(parsedChecklist);
      } catch (err) {
        console.error('Failed to load configuration files:', err);
      }
    };
    loadFiles();
  }, []);

  const addMessage = (role: 'ai' | 'user', text: string) => {
    setMessages(prev => [...prev, { role, text }]);
  };

  const handleStart = (voice: boolean) => {
    setIsVoiceMode(voice);
    setCurrentState(1);
    addMessage('ai', "Welcome! To get started, please tell me your full name and the position you have been shortlisted for.");
  };

  const handleSendMessage = async (text: string) => {
    addMessage('user', text);
    setIsProcessing(true);

    try {
      if (currentState === 1) {
        // Identification
        const identity = await extractIdentity(text);
        if (identity && identity.name && identity.role) {
          setUserData(prev => ({ ...prev, name: identity.name, role: identity.role }));
          setCurrentState(2);
          if (instructions.length > 0) {
            addMessage('ai', `Thanks, ${identity.name}. I have a few instructions to go over. First: ${instructions[0]}. Does that make sense, or do you have any concerns?`);
          } else {
            setCurrentState(3);
            startChecklist();
          }
        } else {
          addMessage('ai', "I didn't quite catch both your name and the role. Could you please provide your full name and the position you're applying for?");
        }
      } else if (currentState === 2) {
        // Instructions
        const evalResult = await evaluateInstructionResponse(text);
        
        if (evalResult.status === 'OBJECTION') {
          setUserData(prev => ({
            ...prev,
            instructionExceptions: [
              ...prev.instructionExceptions,
              { instruction: instructions[currentInstructionIndex], reason: evalResult.reason || text }
            ]
          }));
          addMessage('ai', "I've noted that down for the hiring team.");
        }

        const nextIndex = currentInstructionIndex + 1;
        if (nextIndex < instructions.length) {
          setCurrentInstructionIndex(nextIndex);
          addMessage('ai', `Next instruction: ${instructions[nextIndex]}. Does that make sense, or do you have any concerns?`);
        } else {
          setCurrentState(3);
          startChecklist();
        }
      } else if (currentState === 3) {
        // Checklist
        const evalResult = await evaluateChecklistResponse(text);
        const currentItem = checklist[currentChecklistIndex];

        if (evalResult === 'COMPLETED') {
          setUserData(prev => ({ ...prev, completedTasks: [...prev.completedTasks, currentItem] }));
        } else {
          setUserData(prev => ({ ...prev, pendingTasks: [...prev.pendingTasks, currentItem] }));
        }

        const nextIndex = currentChecklistIndex + 1;
        if (nextIndex < checklist.length) {
          setCurrentChecklistIndex(nextIndex);
          addMessage('ai', `Have you completed this item: ${checklist[nextIndex].item}?`);
        } else {
          setCurrentState(4);
          provideGuidance();
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
      addMessage('ai', "I'm sorry, I encountered an error processing your response. Could you please repeat that?");
    } finally {
      setIsProcessing(false);
    }
  };

  const startChecklist = () => {
    if (checklist.length > 0) {
      addMessage('ai', `Great, let's move on to the pre-onboarding checklist. Have you completed this item: ${checklist[0].item}?`);
    } else {
      setCurrentState(5);
      wrapUp();
    }
  };

  const provideGuidance = () => {
    // We need to use a functional state update to ensure we have the latest pendingTasks
    setUserData(prevUserData => {
      if (prevUserData.pendingTasks.length > 0) {
        let guidanceText = "Here is some guidance on your pending tasks. ";
        prevUserData.pendingTasks.forEach(task => {
          guidanceText += `For the ${task.item}: ${task.guidance} `;
        });
        addMessage('ai', guidanceText + " Please complete these as soon as possible. We are all set for now!");
      } else {
        addMessage('ai', "Excellent! It looks like you have completed all your pre-onboarding tasks. We are all set!");
      }
      setCurrentState(5);
      wrapUp(prevUserData);
      return prevUserData;
    });
  };

  const wrapUp = (finalData?: UserData) => {
    const dataToUse = finalData || userData;
    console.log("Final Report:", dataToUse);
    addMessage('ai', "Thank you for your time. A summary has been sent to the HR team. Have a great day!");
  };

  const handleDownloadReport = async () => {
    try {
      const blob = await generateWordDocument(userData, messages);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${userData.name ? userData.name.replace(/\s+/g, '_') : 'Candidate'}_Onboarding_Report.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate report:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row h-[80vh]">
        
        {/* Sidebar / Status Panel */}
        <div className="w-full md:w-1/3 bg-slate-900 text-white p-8 flex flex-col">
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Onboarding AI</h1>
          </div>

          <div className="space-y-6 flex-1">
            <StatusStep 
              icon={<UserCircle2 className="w-5 h-5" />} 
              title="Identification" 
              active={currentState === 1} 
              completed={currentState > 1} 
            />
            <StatusStep 
              icon={<FileText className="w-5 h-5" />} 
              title="Instructions" 
              active={currentState === 2} 
              completed={currentState > 2} 
            />
            <StatusStep 
              icon={<ClipboardList className="w-5 h-5" />} 
              title="Checklist" 
              active={currentState === 3} 
              completed={currentState > 3} 
            />
            <StatusStep 
              icon={<CheckCircle2 className="w-5 h-5" />} 
              title="Wrap Up" 
              active={currentState >= 4} 
              completed={currentState === 5} 
            />
          </div>

          {currentState === 5 && (
            <div className="mt-auto pt-6 border-t border-slate-700">
              <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">Session Complete</h3>
              <p className="text-sm text-slate-300 mb-4">
                {userData.name ? `${userData.name} - ${userData.role}` : 'Candidate data saved.'}
              </p>
              <button
                onClick={handleDownloadReport}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-md flex items-center justify-center space-x-2"
              >
                <Download className="w-5 h-5" />
                <span>Download Report (Word)</span>
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="w-full md:w-2/3 flex flex-col bg-slate-50 relative">
          {currentState === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                <Bot className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-3xl font-semibold mb-4 text-slate-800 tracking-tight">Welcome to Pre-Onboarding</h2>
              <p className="text-slate-500 mb-10 max-w-md">
                I'm your AI assistant. I'll guide you through a few quick instructions and verify your onboarding checklist.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                <button
                  onClick={() => handleStart(true)}
                  className="flex-1 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-medium transition-all shadow-md hover:shadow-lg flex items-center justify-center"
                >
                  Start Voice Chat
                </button>
                <button
                  onClick={() => handleStart(false)}
                  className="flex-1 py-4 px-6 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-medium transition-all shadow-sm flex items-center justify-center"
                >
                  Start Text Chat
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 md:p-6 flex flex-col h-full overflow-hidden">
              <Chat
                messages={messages}
                onSendMessage={handleSendMessage}
                isVoiceMode={isVoiceMode}
                isProcessing={isProcessing}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusStep({ icon, title, active, completed }: { icon: React.ReactNode, title: string, active: boolean, completed: boolean }) {
  return (
    <div className={`flex items-center space-x-4 transition-opacity duration-300 ${active ? 'opacity-100' : completed ? 'opacity-50' : 'opacity-30'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${active ? 'bg-indigo-500 text-white' : completed ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
        {completed ? <CheckCircle2 className="w-5 h-5" /> : icon}
      </div>
      <span className={`font-medium ${active ? 'text-white' : completed ? 'text-slate-300' : 'text-slate-500'}`}>
        {title}
      </span>
    </div>
  );
}
