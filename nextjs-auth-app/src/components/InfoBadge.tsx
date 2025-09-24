interface InfoBadgeProps {
  onClick: () => void;
  tooltip?: string;
  className?: string;
}

const InfoBadge: React.FC<InfoBadgeProps> = ({ onClick, tooltip, className = "" }) => {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center w-5 h-5 text-xs bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${className}`}
      title={tooltip}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
};

export default InfoBadge;