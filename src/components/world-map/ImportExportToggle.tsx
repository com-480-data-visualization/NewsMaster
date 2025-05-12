import React from "react";

type ImportExportToggleProps = {
  mode: 'import' | 'export';
  setMode: (mode: 'import' | 'export') => void;
};

export const ImportExportToggle: React.FC<ImportExportToggleProps> = ({
  mode,
  setMode,
}) => {
  return (
    <div className="flex bg-muted rounded-md p-0.5 overflow-hidden">
      <button
        onClick={() => setMode('import')}
        className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
          mode === 'import' 
            ? 'bg-background shadow-sm' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Import
      </button>
      <button
        onClick={() => setMode('export')}
        className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
          mode === 'export' 
            ? 'bg-background shadow-sm' 
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Export
      </button>
    </div>
  );
}; 