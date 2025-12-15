import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Bot, Send, Sparkles, Lightbulb, Search, MessageSquare } from 'lucide-react';

const API_BASE = '/api/v1';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAgents() {
  const [selectedAgent, setSelectedAgent] = useState<'energy_analyst' | 'detective' | 'recommender'>('energy_analyst');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<number | null>(null);

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/recommendations`);
      return response.json();
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch(`${API_BASE}/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          agent_type: selectedAgent,
          session_id: sessionId,
        }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSessionId(data.session_id);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    chatMutation.mutate(input);
    setInput('');
  };

  const agents = [
    { id: 'energy_analyst', name: 'Energy Analyst', icon: Sparkles, color: 'blue', desc: 'Analyze consumption patterns and anomalies' },
    { id: 'detective', name: 'Detective', icon: Search, color: 'purple', desc: 'Investigate unassigned loads and hypotheses' },
    { id: 'recommender', name: 'Recommender', icon: Lightbulb, color: 'amber', desc: 'Get optimization recommendations' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="w-7 h-7 text-blue-600" />
          AI Agents
        </h1>
        <p className="text-gray-500 mt-1">Intelligent assistants for energy analysis and optimization</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => {
              setSelectedAgent(agent.id as any);
              setMessages([]);
              setSessionId(null);
            }}
            className={`p-5 rounded-xl border-2 text-left transition-all ${
              selectedAgent === agent.id
                ? `border-${agent.color}-500 bg-${agent.color}-50`
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg bg-${agent.color}-100`}>
                <agent.icon className={`w-5 h-5 text-${agent.color}-600`} />
              </div>
              <h3 className="font-semibold text-gray-900">{agent.name}</h3>
            </div>
            <p className="text-sm text-gray-500">{agent.desc}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
          <div className="p-4 border-b flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Chat with {agents.find(a => a.id === selectedAgent)?.name}</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Start a conversation</p>
                <p className="text-sm mt-1">Ask me about your energy data and I'll help analyze it</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {['Why did consumption spike last month?', 'Analyze my peak demand patterns', 'Find energy saving opportunities'].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask a question about your energy data..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Recommendations
          </h2>
          
          {(recommendations?.length || 0) === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No recommendations yet</p>
              <p className="text-xs mt-1">Chat with the AI to get insights</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations?.slice(0, 5).map((rec: any) => (
                <div key={rec.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                      rec.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {rec.priority}
                    </span>
                    <span className="text-xs text-gray-500">{rec.category}</span>
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm">{rec.title}</h3>
                  {rec.expected_savings && (
                    <p className="text-xs text-green-600 mt-1">Est. savings: ${rec.expected_savings.toLocaleString()}/yr</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
