"use client";

import { useState } from "react";

export default function AIAssistant({ emailContent, onQuickReply }) {
  const [summary, setSummary] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [replies, setReplies] = useState(null);
  const [isReplying, setIsReplying] = useState(false);

  const handleSummarize = async () => {
    setIsSummarizing(true);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailContent })
      });
      const data = await res.json();
      setSummary(data.summary || data.error);
    } catch (e) {
      setSummary("Failed to generate summary.");
    }
    setIsSummarizing(false);
  };

  const handleSmartReply = async () => {
    setIsReplying(true);
    try {
      const res = await fetch("/api/ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailContent })
      });
      const data = await res.json();
      setReplies(data.replies || [data.error]);
    } catch (e) {
      setReplies(["Failed to generate replies."]);
    }
    setIsReplying(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
      {/* AI Controls */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button 
          onClick={handleSummarize} 
          disabled={isSummarizing || summary}
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            padding: '8px 16px',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            cursor: (isSummarizing || summary) ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            opacity: isSummarizing ? 0.7 : 1
          }}
          onMouseOver={(e) => { if(!isSummarizing && !summary) { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; } }}
          onMouseOut={(e) => { if(!isSummarizing && !summary) { e.currentTarget.style.background = 'var(--glass-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
        >
          ✨ {isSummarizing ? 'Summarizing...' : summary ? 'Summarized' : 'Summarize'}
        </button>

        <button 
          onClick={handleSmartReply} 
          disabled={isReplying || replies}
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            padding: '8px 16px',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            cursor: (isReplying || replies) ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            opacity: isReplying ? 0.7 : 1
          }}
          onMouseOver={(e) => { if(!isReplying && !replies) { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; } }}
          onMouseOut={(e) => { if(!isReplying && !replies) { e.currentTarget.style.background = 'var(--glass-bg)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
        >
          💬 {isReplying ? 'Generating...' : replies ? 'Replies Generated' : 'Smart Reply'}
        </button>
      </div>

      {/* AI Output */}
      {summary && (
        <div style={{ 
          background: 'rgba(255,255,255,0.05)', 
          border: '1px solid rgba(255,255,255,0.1)', 
          padding: '16px', 
          borderRadius: '12px',
          color: 'var(--text-primary)',
          fontSize: '0.95rem'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✨ AI Summary
          </div>
          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{summary}</div>
        </div>
      )}

      {replies && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {replies.map((reply, i) => (
            <button
              key={i}
              onClick={() => onQuickReply(reply)}
              style={{
                background: 'var(--accent)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '0.9rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {reply}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
