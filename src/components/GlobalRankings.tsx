import React from 'react';
import { importData, exportData, countryNameMap } from '../data/mapData';

type Props = {
  mode: 'import' | 'export';
};

const GlobalRankings: React.FC<Props> = ({ mode }) => {
  const data = mode === 'import' ? importData : exportData;
  
  // Sort countries by value (descending) and take top 10
  const topCountries = Object.entries(data)
    .sort(([, valueA], [, valueB]) => valueB - valueA)
    .slice(0, 10);

  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm">
      <h3 className="font-bold text-lg mb-2 text-foreground">
        Top 10 {mode === 'import' ? 'Importers' : 'Exporters'}
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        {mode === 'import' 
          ? 'Countries that receive the most coverage in foreign media' 
          : 'Countries whose media provides the most coverage of foreign events'}
      </p>
      <div className="overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-muted">
              <th className="text-left py-2 font-medium text-sm text-muted-foreground">#</th>
              <th className="text-left py-2 font-medium text-sm text-muted-foreground">Country</th>
              <th className="text-right py-2 font-medium text-sm text-muted-foreground">Share</th>
            </tr>
          </thead>
          <tbody>
            {topCountries.map(([id, value], index) => (
              <tr key={id} className="border-b border-muted last:border-0">
                <td className="py-2 text-sm">{index + 1}</td>
                <td className="py-2 text-sm">{countryNameMap[id] || id}</td>
                <td className="py-2 text-sm text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-muted rounded-full h-1.5">
                      <div 
                        className={`${mode === 'import' ? 'bg-blue-500' : 'bg-green-500'} h-1.5 rounded-full`}
                        style={{ width: `${(value / topCountries[0][1]) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-muted-foreground">
                      {(value * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GlobalRankings; 