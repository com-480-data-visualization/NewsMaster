import React from 'react';
import { importColorScale, exportColorScale, importData, exportData } from '../../data/mapData';

type Props = {
  mode: 'import' | 'export';
};

const Legend: React.FC<Props> = ({ mode }) => {
  const colorScale = mode === 'import' ? importColorScale : exportColorScale;
  const data = mode === 'import' ? importData : exportData;
  const maxValue = Math.max(...Object.values(data));
  
  return (
    <div className="p-4 bg-card border rounded-lg shadow-sm">
      <h3 className="text-sm font-medium mb-2">Legend</h3>
      
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Media {mode === 'import' ? 'Import' : 'Export'} percentage
        </div>
        
        {/* Gradient bar */}
        <div 
          className="w-full h-3 rounded-sm overflow-hidden" 
          style={{ 
            background: `linear-gradient(to right, 
              ${colorScale(0)}, ${colorScale(maxValue)}
            )` 
          }}
        ></div>
        
        {/* Markers */}
        <div className="flex justify-between w-full text-xs text-muted-foreground">
          <div>0%</div>
          <div>25%</div>
          <div>50%</div>
          <div>75%</div>
          <div>100%</div>
        </div>
      </div>
    </div>
  );
};

export default Legend; 