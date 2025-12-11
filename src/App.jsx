import { useState } from 'react';
import axios from 'axios';

function App() {
  const [routeNo, setRouteNo] = useState('');
  const [busData, setBusData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchBusData = async () => {
    if (!routeNo) return;
    setLoading(true);
    setError('');
    setBusData([]);

    // Logic for environment-based URL
    // In Dev: Vite proxy handles /bresws -> http://www.dsat.gov.mo/bresws
    // In Prod: Use CORS proxy
    const isDev = import.meta.env.DEV;
    const API_URL = isDev 
      ? '/bresws/BusEnquiryServices.asmx' 
      : 'https://cors-anywhere.herokuapp.com/http://www.dsat.gov.mo/bresws/BusEnquiryServices.asmx';

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SearchRouteByBusNumber xmlns="http://tempuri.org/">
      <RouteNo>${routeNo}</RouteNo>
      <Token>0</Token> 
    </SearchRouteByBusNumber>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await axios.post(API_URL, soapEnvelope, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          // SOAPAction is often required
          'SOAPAction': 'http://tempuri.org/SearchRouteByBusNumber',
        },
      });

      const xmlText = response.data;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Check for SOAP Faults or API errors first
      // Assuming successful response structure:
      // <SearchRouteByBusNumberResult> ... <BusInfo>...</BusInfo> </SearchRouteByBusNumberResult>

      const busNodes = xmlDoc.getElementsByTagName('BusInfo');
      const buses = [];

      for (let i = 0; i < busNodes.length; i++) {
        const node = busNodes[i];
        // Extract fields. Note: exact tag names depend on API. 
        // Common guess: <BusPlate>, <CurrentStopName>, <StopSeq>, etc. 
        // We will dump the text content of children for display if specific tags are unknown, 
        // or try to find common ones.
        // Let's assume standard names given the prompt context, but "BusInfo" is the node.
        
        // Helper to safely get value
        const getValue = (tagName) => node.getElementsByTagName(tagName)[0]?.textContent || 'N/A';

        buses.push({
          id: i,
          plate: getValue('BusPlate') !== 'N/A' ? getValue('BusPlate') : getValue('BusNo'), // Fallback
          stopSeq: getValue('StopSeq'),
          status: getValue('Status'), // e.g. "Traveling"
          updateTime: new Date().toLocaleTimeString(),
        });
      }
      
      if (buses.length === 0) {
        // Did we get a result but no buses? Or invalid XML?
        // Check if there's any error message in the XML
        // Sometimes APIs return 200 OK but XML contains error
        if (xmlDoc.getElementsByTagName('Error').length > 0) {
            throw new Error('API returned an error.');
        }
      }

      setBusData(buses);
      setLastUpdated(new Date().toLocaleTimeString());

    } catch (err) {
      console.error(err);
      setError('Failed to fetch data. Ensure CORS proxy is working or check Route Number.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBusData();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-gray-800">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl">
        <div className="p-8">
          <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold mb-2">Macau DSAT Bus Tracker</div>
          <h1 className="block mt-1 text-lg leading-tight font-medium text-black">Find Bus by Route</h1>
          
          <form onSubmit={handleSearch} className="mt-6 flex gap-2">
            <input 
              type="text" 
              value={routeNo}
              onChange={(e) => setRouteNo(e.target.value)}
              placeholder="Enter Route (e.g. 33)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              type="submit" 
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200"
            >
              Search
            </button>
          </form>

          {/* Warning for Demo */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
            <strong>Note:</strong> In production (GitHub Pages), this demo uses a public CORS proxy. It may be slow or rate-limited.
          </div>

          {/* Status / Error */}
          {loading && (
            <div className="mt-6 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {error && (
            <div className="mt-6 text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          {/* Results */}
          {!loading && !error && busData.length > 0 && (
            <div className="mt-6">
               <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Route: {routeNo}</h2>
                  <div className="text-xs text-gray-500">
                    Updated: {lastUpdated}
                    <button 
                      onClick={fetchBusData} 
                      className="ml-2 text-indigo-600 underline cursor-pointer hover:text-indigo-800"
                    >
                      Refresh
                    </button>
                  </div>
               </div>
               
               <div className="space-y-3">
                 {busData.map((bus) => (
                   <div key={bus.id} className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-gray-700">Bus Plate: {bus.plate}</div>
                        <div className="text-xs text-gray-500">Stop Sequence: {bus.stopSeq}</div>
                      </div>
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {!loading && !error && busData.length === 0 && lastUpdated && (
            <div className="mt-6 text-center text-gray-500">
              No active buses found for this route.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
