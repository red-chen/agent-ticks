import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Agent } from '../types';

interface AgentSelectorProps {
  agents: Agent[];
  onSelect: (agentId: string) => void;
  onClose: () => void;
}

export function AgentSelector({ agents, onSelect, onClose }: AgentSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredAgents = agents.filter((agent) => {
    const query = search.toLowerCase();
    return (
      agent.name.toLowerCase().includes(query) ||
      agent.description.toLowerCase().includes(query) ||
      agent.kind.toLowerCase().includes(query)
    );
  });

  const handleSelect = (agentId: string) => {
    console.log('[AgentSelector] Agent selected:', agentId);
    console.log('[AgentSelector] Calling onSelect');
    onSelect(agentId);
    console.log('[AgentSelector] onSelect called, calling onClose');
    onClose();
    console.log('[AgentSelector] onClose called');
  };

  return (
    <div className="agent-selector-overlay" onClick={onClose}>
      <div className="agent-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="agent-selector-header">
          <h3>Select Agent</h3>
          <button className="agent-selector-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="agent-selector-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="agent-selector-list">
          {filteredAgents.length > 0 ? (
            filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="agent-selector-item"
                onClick={() => handleSelect(agent.id)}
              >
                <div className="agent-selector-item-header">
                  <span className="agent-selector-item-name">{agent.name}</span>
                  <span className="agent-selector-item-kind">{agent.kind}</span>
                </div>
                {agent.description && (
                  <div className="agent-selector-item-description">{agent.description}</div>
                )}
              </div>
            ))
          ) : (
            <div className="agent-selector-empty">No agents found</div>
          )}
        </div>
      </div>
    </div>
  );
}
