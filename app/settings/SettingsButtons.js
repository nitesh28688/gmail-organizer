"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SettingsButtons() {
  const searchParams = useSearchParams();
  const activeAccountId = searchParams.get("account") || "";

  const [auditStatus, setAuditStatus] = useState("Run Inbox Audit");
  
  const [aliasName, setAliasName] = useState("");
  const [aliasEmail, setAliasEmail] = useState("");
  const [aliasStatus, setAliasStatus] = useState("Add Send-As Alias");

  const handleAudit = async () => {
    setAuditStatus("Scanning inbox (this may take a minute)...");
    try {
      const res = await fetch("/api/gmail/audit", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: activeAccountId })
      });
      if (!res.ok) throw new Error("Audit failed");
      setAuditStatus("Audit complete! ✅");
      setTimeout(() => setAuditStatus("Run Inbox Audit"), 5000);
    } catch (e) {
      console.error(e);
      setAuditStatus("Audit encountered an error ❌");
      setTimeout(() => setAuditStatus("Run Inbox Audit"), 3000);
    }
  };

  const handleAddAlias = async (e) => {
    e.preventDefault();
    if (!aliasName || !aliasEmail) return;
    
    setAliasStatus("Adding...");
    try {
      const res = await fetch("/api/gmail/alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: aliasName, email: aliasEmail })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add alias");
      
      setAliasStatus("Added successfully! Check your email to confirm.");
      setAliasName("");
      setAliasEmail("");
      setTimeout(() => setAliasStatus("Add Send-As Alias"), 4000);
    } catch (e) {
      console.error(e);
      setAliasStatus("Error adding alias");
      setTimeout(() => setAliasStatus("Add Send-As Alias"), 3000);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '24px', maxWidth: '800px' }}>
      <div className="glass-panel" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>1. Add New Send-As Alias</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Connect a new email alias to your account. Google will send a verification email to that address if it belongs to a different domain.
        </p>
        
        <form onSubmit={handleAddAlias} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Display Name</label>
            <input 
              type="text" 
              value={aliasName} 
              onChange={e => setAliasName(e.target.value)} 
              placeholder="e.g. John Doe"
              style={{ width: '100%', padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Email Address</label>
            <input 
              type="email" 
              value={aliasEmail} 
              onChange={e => setAliasEmail(e.target.value)} 
              placeholder="e.g. hello@example.com"
              style={{ width: '100%', padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
              required
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{ background: 'var(--accent)', marginTop: '8px' }} disabled={aliasStatus === "Adding..."}>
            {aliasStatus}
          </button>
        </form>
      </div>

      <div className="glass-panel" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>2. Retroactive Audit</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Scans your entire existing inbox history and retroactively applies the labels defined above. This handles Gmail API rate limits automatically.
        </p>
        <button className="btn-primary" onClick={handleAudit} style={{ background: '#16a766' }}>
          {auditStatus}
        </button>
      </div>
    </div>
  );
}
