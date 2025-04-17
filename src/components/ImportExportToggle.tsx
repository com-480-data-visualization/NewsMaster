import * as React from "react"
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react"

import { Button } from "@/components/ui/button"

type ImportExportToggleProps = {
  mode: 'import' | 'export';
  setMode: (mode: 'import' | 'export') => void;
}

export function ImportExportToggle({ mode, setMode }: ImportExportToggleProps) {
  return (
    <div className="flex items-center bg-background rounded-md border p-1">
      <Button
        variant={mode === 'import' ? "default" : "ghost"}
        size="sm"
        onClick={() => setMode('import')}
        className="flex items-center"
      >
        <ArrowDownToLine className="h-4 w-4 mr-1" />
        <span>Import</span>
      </Button>
      <Button
        variant={mode === 'export' ? "default" : "ghost"}
        size="sm"
        onClick={() => setMode('export')}
        className="flex items-center"
      >
        <ArrowUpFromLine className="h-4 w-4 mr-1" />
        <span>Export</span>
      </Button>
    </div>
  )
} 