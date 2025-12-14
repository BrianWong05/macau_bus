
import React, { useState } from 'react';
import { ALL_ROUTES } from '../data/routes';

interface RouteDashboardProps {
  onSelectRoute: (route: string) => void;
}

const RouteDashboard: React.FC<RouteDashboardProps> = ({ onSelectRoute }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRoutes = ALL_ROUTES.filter(route => 
    route.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gray-50 p-4">
      {/* Search Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">All Routes</h2>
        <input
          type="text"
          placeholder="Search Route (e.g. 33, 26A)..."
          className="w-full p-3 rounded-xl border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 content-start">
          {filteredRoutes.map(route => (
            <button
              key={route}
              onClick={() => onSelectRoute(route)}
              className="aspect-square flex items-center justify-center bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-400 rounded-lg shadow-sm hover:shadow-md transition-all group"
            >
              <span className="text-lg font-bold text-gray-700 group-hover:text-blue-600">
                {route}
              </span>
            </button>
          ))}
          
          {filteredRoutes.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-500">
              No routes found matching "{searchTerm}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteDashboard;
