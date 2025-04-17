import React from 'react';
import { importData, exportData, countryNameMap } from '../../data/mapData';

type Props = {
  selectedCountry: string | null;
  mode: 'import' | 'export';
};

const CountryInfoPanel: React.FC<Props> = ({ selectedCountry, mode }) => {
  if (!selectedCountry) {
    return null;
  }

  const countryName = countryNameMap[selectedCountry] || selectedCountry;
  const data = mode === 'import' ? importData : exportData;
  const percentage = ((data[selectedCountry] || 0) * 100).toFixed(1);

  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      <h3 className="text-lg font-medium mb-2">{countryName}</h3>
      <div className="text-sm">
        <p className="mb-1">
          <span className="font-medium">Media {mode === 'import' ? 'Import' : 'Export'}:</span> {percentage}%
        </p>
        <p className="text-xs text-muted-foreground">
          {mode === 'import'
            ? 'How much this country is featured in foreign news'
            : 'How much this country\'s media covers foreign events'}
        </p>
      </div>
    </div>
  );
};

export default CountryInfoPanel; 