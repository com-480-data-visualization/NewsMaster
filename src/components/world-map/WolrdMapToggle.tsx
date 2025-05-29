import React from "react";

type ForeignPressMode = 'featured' | 'covering';

type ForeignPressToggleProps = {
  mode: ForeignPressMode;
  setMode: (mode: ForeignPressMode) => void;
};

export const ForeignPressToggle: React.FC<ForeignPressToggleProps> = ({
  mode,
  setMode,
}) => {
  return (
    <div className="flex bg-muted rounded-md p-0.5 overflow-hidden">
      <button
        onClick={() => setMode('featured')}
        className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
          mode === 'featured' 
            ? 'bg-background shadow-sm' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Featured
      </button>
      <button
        onClick={() => setMode('covering')}
        className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
          mode === 'covering' 
            ? 'bg-background shadow-sm' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Covering
      </button>
    </div>
  );
};

export type { ForeignPressMode }; 