import { Suspense } from "react";
import InboxClient from "./InboxClient";

export default function InboxPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>Loading inbox data...</div>}>
      <InboxClient />
    </Suspense>
  );
}
