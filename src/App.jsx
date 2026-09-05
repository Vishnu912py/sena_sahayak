import React, { useState, useRef, useEffect } from 'react';
import { Phone, ArrowRight, User, CheckCircle2, AlertCircle, FileText, MapPin, Search } from 'lucide-react';
import soldierIcon from '../soldier.png';

const POLICLINICS = [
  { city: 'Delhi', name: 'Base Hospital Delhi Cantt', address: 'Delhi Cantt, New Delhi, 110010' },
  { city: 'Pune', name: 'Command Hospital (SC)', address: 'Wanowrie, Pune, 411040' },
  { city: 'Chandigarh', name: 'Command Hospital (WC)', address: 'Chandimandir, Chandigarh, 134107' },
  { city: 'Lucknow', name: 'Command Hospital (CC)', address: 'Lucknow Cantt, 226002' }
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('INTAKE'); // INTAKE, SUMMARY, CHECKLIST, RESOURCES
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [chatHistory, setChatHistory] = useState([]);
  const [inputValue, setInputValue] = useState('');
  
  const [analysisResult, setAnalysisResult] = useState({ eligibility_results: [], action_checklist: [], summary_text: null });
  
  const chatEndRef = useRef(null);

  // Fetch questions on mount
  useEffect(() => {
    fetch('http://localhost:3000/api/questions')
      .then(res => res.json())
      .then(data => {
        setQuestions(data.questions);
        if (data.questions.length > 0) {
          setChatHistory([
            { type: 'system', text: "Hello. I'm here to help you figure out your eligibility and next steps for support." },
            { type: 'system', questionId: data.questions[0].id, text: data.questions[0].text, qType: data.questions[0].type, options: data.questions[0].options }
          ]);
        }
      })
      .catch(err => console.error("Error fetching questions:", err));
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleAnswerSubmit = (value) => {
    if (!value.toString().trim()) return;

    const currentQ = questions[currentQuestionIdx];
    
    // Save answer
    const newAnswers = { ...answers, [currentQ.id]: value };
    setAnswers(newAnswers);
    
    // Add user message to history
    setChatHistory(prev => [...prev, { type: 'user', text: value }]);
    setInputValue('');

    // Check if we have more questions
    if (currentQuestionIdx + 1 < questions.length) {
      const nextQ = questions[currentQuestionIdx + 1];
      setTimeout(() => {
        setChatHistory(prev => [...prev, { 
          type: 'system', 
          questionId: nextQ.id, 
          text: nextQ.text, 
          qType: nextQ.type, 
          options: nextQ.options,
          placeholder: nextQ.placeholder
        }]);
        setCurrentQuestionIdx(prev => prev + 1);
      }, 600);
    } else {
      // Finished all questions, transition to SUMMARY after fetching from backend
      setTimeout(() => {
        setChatHistory(prev => [...prev, { type: 'system', text: 'Thank you for sharing. I am analyzing your situation now...' }]);
        
        fetch('http://localhost:3000/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAnswers)
        })
        .then(res => res.json())
        .then(data => {
           setAnalysisResult(data);
           setTimeout(() => {
             setCurrentScreen('SUMMARY');
           }, 1500);
        })
        .catch(err => console.error("Error analyzing:", err));
        
      }, 600);
    }
  };

  const { eligibility_results, action_checklist, summary_text } = analysisResult;

  if (questions.length === 0) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full bg-card border-b border-border p-4 sticky top-0 z-50 flex justify-center shadow-sm">
        <div className="w-full max-w-2xl flex justify-between items-center">
          <h1 className="font-bold text-lg text-foreground flex items-center gap-2">
            <img src={soldierIcon} alt="" className="soldier-icon soldier-icon-header" />
            Sena Sahayak
          </h1>
          <a href="tel:14499" className="text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-4 py-2 rounded-full font-semibold hover:bg-red-200 transition-colors flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Crisis Line: 14499
          </a>
        </div>
      </header>

      <main className="w-full max-w-2xl flex-1 flex flex-col p-4 sm:p-6 w-full">
        {currentScreen === 'INTAKE' && (
          <div className="flex-1 flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden h-[75vh]">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex gap-3 max-w-[85%] ${msg.type === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.type === 'user' ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}>
                    {msg.type === 'user' ? <User className="w-5 h-5" /> : <img src={soldierIcon} alt="Sena Sahayak" className="soldier-icon" />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm shadow-sm ${msg.type === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-background border border-border text-foreground rounded-tl-none'}`}>
                    <p className="mb-2 whitespace-pre-wrap">{msg.text}</p>
                    
                    {/* Render Options for System Questions */}
                    {msg.type === 'system' && msg.qType === 'single_choice' && i === chatHistory.length - 1 && (
                      <div className="flex flex-col gap-2 mt-3">
                        {msg.options.map(opt => (
                          <button 
                            key={opt}
                            onClick={() => handleAnswerSubmit(opt)}
                            className="text-left px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted hover:border-primary/50 transition-all font-medium text-primary text-sm"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-4 bg-background border-t border-border">
              {questions[currentQuestionIdx]?.type !== 'single_choice' && (
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleAnswerSubmit(inputValue); }} 
                  className="relative flex items-center"
                >
                  <input 
                    type={questions[currentQuestionIdx]?.type === 'number' ? 'number' : 'text'}
                    placeholder={questions[currentQuestionIdx]?.placeholder || "Type your response..."}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full bg-card border border-border rounded-full pl-5 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    autoFocus
                  />
                  <button 
                    type="submit" 
                    disabled={!inputValue.trim()}
                    className="absolute right-2 p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {currentScreen === 'SUMMARY' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-foreground">Your Situation Summary</h2>

            {/* Gemini warm summary — shown when available */}
            {summary_text && (
              <div className="p-5 bg-primary/5 border border-primary/20 rounded-xl shadow-sm">
                <p className="text-foreground leading-relaxed">{summary_text}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  This summary was generated by AI based only on the eligibility findings below. It is not legal advice.
                </p>
              </div>
            )}

            {/* Structured eligibility results from rules engine */}
            <h3 className="font-semibold text-foreground">Eligibility Findings</h3>
            <div className="space-y-4">
              {eligibility_results.length > 0 ? eligibility_results.map((r, i) => (
                <div key={i} className="flex gap-3 items-start p-4 bg-card border border-border rounded-xl shadow-sm">
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground leading-relaxed">{r.plain_language}</p>
                    <p className="text-xs text-muted-foreground mt-1">Source: {r.source}</p>
                  </div>
                </div>
              )) : (
                <div className="p-4 bg-card border border-border rounded-xl shadow-sm text-foreground">
                  We could not determine specific eligibility from your answers. Please review the checklist for general guidance.
                </div>
              )}
            </div>

            {/* Flag appeal-related findings */}
            {eligibility_results.some(r => r.eligible_for?.toLowerCase().includes('appeal')) && (
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-900 dark:text-red-200 mb-1">Important: Grounds for Appeal Identified</p>
                    <p className="text-sm text-red-900 dark:text-red-200 opacity-90">
                      The findings above include legal grounds that courts have recognised in similar cases. See the checklist for specific appeal steps and case citations you can reference.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={() => setCurrentScreen('CHECKLIST')}
              className="w-full mt-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              See Action Checklist
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {currentScreen === 'CHECKLIST' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-foreground">Action Checklist</h2>
            <p className="text-muted-foreground">Here are concrete next steps tailored to your specific situation.</p>
            
            <div className="space-y-3">
              {action_checklist.map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-card border border-border rounded-xl shadow-sm">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-foreground text-sm leading-relaxed">
                    {typeof item === 'string' ? item : `${item.title}${item.desc ? ': ' + item.desc : ''}`}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setCurrentScreen('SUMMARY')}
                className="flex-1 py-3 bg-card border border-border text-foreground font-medium rounded-xl hover:bg-muted transition-colors"
              >
                Back to Summary
              </button>
              <button 
                onClick={() => setCurrentScreen('RESOURCES')}
                className="flex-1 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                View Resources
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {currentScreen === 'RESOURCES' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-foreground">Support & Resources</h2>
            <p className="text-muted-foreground">Find local ECHS polyclinics and important documents.</p>
            
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/50 flex items-center gap-3">
                <Search className="w-5 h-5 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search by city (e.g., Delhi, Pune)..." 
                  className="bg-transparent border-none focus:outline-none w-full text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="divide-y divide-border">
                {POLICLINICS.map((clinic, i) => (
                  <div key={i} className="p-4 hover:bg-muted/50 transition-colors flex items-start gap-4">
                    <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground">{clinic.name}</h4>
                      <p className="text-sm text-muted-foreground">{clinic.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 bg-card border border-border rounded-xl shadow-sm">
               <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                 <FileText className="w-5 h-5 text-primary" />
                 Important Documents
               </h3>
               <ul className="space-y-2 text-sm text-primary">
                 <li><a href="#" className="hover:underline">ECHS Enrollment Form (PDF)</a></li>
                 <li><a href="#" className="hover:underline">Guide to Medical Board Appeals (PDF)</a></li>
                 <li><a href="#" className="hover:underline">Legal Precedent Summary: Dharamvir Singh (PDF)</a></li>
               </ul>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setCurrentScreen('CHECKLIST')}
                className="w-full py-3 bg-card border border-border text-foreground font-medium rounded-xl hover:bg-muted transition-colors"
              >
                Back to Checklist
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
