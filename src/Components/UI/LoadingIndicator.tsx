export default function LoadingIndicator({ children }: { children: React.ReactNode }) {
  return <div className="pending-message" role="status">
    <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>
    {children}
  </div>;
}
