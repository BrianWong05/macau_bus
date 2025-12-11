import { useState } from 'react';
import axios from 'axios';
import md5 from 'js-md5';

function App() {
  const [routeNo, setRouteNo] = useState('');
  const [direction, setDirection] = useState('0'); // '0' or '1'
  const [busData, setBusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDev = import.meta.env.DEV;

  // Reverse-engineered Token Logic
  const generateDsatToken = (params) => {
    let queryString = "";
    Object.keys(params).forEach((key, index) => {
        queryString += (index === 0 ? "" : "&") + key + "=" + params[key];
    });
    
    const dirtyHash = md5(queryString);
    const date = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const YYYY = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const DD = pad(date.getDate());
    const HH = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const timeStr = `${YYYY}${MM}${DD}${HH}${mm}`;
    
    let arr = dirtyHash.split("");
    const part3 = timeStr.slice(8);
    const part2 = timeStr.slice(4, 8);
    const part1 = timeStr.slice(0, 4);
    
    arr.splice(24, 0, part3);
    arr.splice(12, 0, part2);
    arr.splice(4, 0, part1);
    
    return arr.join("");
  };

  const handleSearch = async () => {
    if (!routeNo) return;
    setLoading(true);
    setError('');
    setBusData(null);

    const targetUrl = isDev 
      ? '/macauweb/getRouteData.html' 
      : 'https://cors-anywhere.herokuapp.com/https://bis.dsat.gov.mo:37812/macauweb/getRouteData.html';

    // JSON API Params
    const params = {
      routeName: routeNo,
      dir: direction,
      lang: 'zh-tw',
      device: 'web'
    };

    const token = generateDsatToken(params);
    const body = new URLSearchParams(params).toString();

    try {
      const response = await axios.post(targetUrl, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'token': token
        }
      });

      console.log("API Response:", response.data);
      const data = response.data.data;

      if (!data) {
        throw new Error("No data found for this route.");
      }
      
      const routeInfo = data.routeInfo || [];
      // Initial bus data from getRouteData (usually empty for buses, but good for stops)
      
      const stops = routeInfo.map(stop => ({
          ...stop,
          buses: [] // Initialize empty buses array for each stop
      }));

      setBusData({
        stops: stops,
        buses: [], // Global list if needed
        raw: data
      });
      
      // Trigger Realtime Update immediately
      fetchRealtimeBus(routeNo, direction, stops);

    } catch (err) {
      console.error(err);
      setError('Error fetching data. Route might be invalid or authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to map busType
  const getBusTypeLabel = (type) => {
      switch(type) {
          case '1': return 'Large'; // 大巴
          case '2': return 'Medium'; // 中巴
          case '3': return 'Small'; // 小巴
          default: return type;
      }
  };

  const fetchRealtimeBus = async (rNo, dir, currentStops) => {
      // routeType varies (N2=0, N3=2, 33=2). 
      // Without a map, we probe both 0 and 2.
      const typesToTry = ['0', '1', '2']; // Try 0, 1, 2 to be safe? Spy saw 0 and 2. 
      // Let's stick to 0 and 2 for now based on observations. N3 and 33 are 2. N2 is 0.
      const candidateTypes = ['0', '2'];

      const requests = candidateTypes.map(type => {
          const params = {
              action: 'dy',
              routeName: rNo,
              dir: dir,
              lang: 'zh-tw',
              routeType: type,
              device: 'web'
          };
          const token = generateDsatToken(params);
          const body = new URLSearchParams(params).toString();
          
          const targetUrl = isDev 
            ? '/macauweb/routestation/bus' 
            : 'https://cors-anywhere.herokuapp.com/https://bis.dsat.gov.mo:37812/macauweb/routestation/bus';
            
          return axios.post(targetUrl, body, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'token': token
                }
          }).then(res => ({ type, data: res.data })).catch(err => ({ type, error: err }));
      });

      try {
          const results = await Promise.all(requests);
          
          // Find the one with header "000"
          const validResult = results.find(r => r.data && r.data.header === "000");
          
          if (validResult && validResult.data && validResult.data.data && validResult.data.data.routeInfo) {
              console.log(`Found valid data with routeType=${validResult.type}`);
              const realtimeStops = validResult.data.data.routeInfo;
              
              // Merge bus info into currentStops
              // Match by staCode
              const updatedStops = currentStops.map(stop => {
                  const match = realtimeStops.find(rs => rs.staCode === stop.staCode);
                  if (match && match.busInfo && match.busInfo.length > 0) {
                      return { ...stop, buses: match.busInfo };
                  }
                  return { ...stop, buses: [] };
              });
              
              // Extract all active buses for summary
              const allBuses = updatedStops.flatMap(s => s.buses).map(b => ({
                  ...b,
                  plate: b.busPlate,
                  speed: b.speed
              }));

              setBusData(prev => ({
                  ...prev,
                  stops: updatedStops,
                  buses: allBuses
              }));
          } else {
             console.warn("No valid realtime data found in probes:", results);
          }
      } catch (e) {
          console.error("Realtime fetch failed", e);
      }
  };

  const toggleDirection = () => {
      setDirection(prev => prev === '0' ? '1' : '0');
      // Should clear data or re-search?
      // Ideally re-search if we have a route number
      if (routeNo) {
          // We can't call handleSearch directly due to stale state in closure?
          // But we setting state triggers re-render.
          // Better: just clear data. User clicks search again? 
          // Or effect? Let's just clear for now.
          setBusData(null); 
      }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <h1 className="text-xl font-bold mb-4 text-center text-teal-600">Macau Bus Waiting</h1>
        
        {/* Search Input */}
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            value={routeNo} 
            onChange={(e) => setRouteNo(e.target.value)} 
            placeholder="Route No. (e.g. 33, N2)"
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button 
            onClick={handleSearch}
            className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 transition"
          >
            Search
          </button>
        </div>

        {/* Direction Toggle */}
        <div className="flex justify-center mb-4">
            <button 
                onClick={toggleDirection}
                className="text-sm text-teal-600 underline"
            >
                Switch Direction (Current: {direction === '0' ? 'Forward' : 'Backward'})
            </button>
        </div>

        {/* Refresh Button */}
        {busData && (
           <div className="flex justify-end mb-2">
             <button 
               onClick={handleSearch}
               className="text-gray-500 text-sm flex items-center gap-1 hover:text-teal-600"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
               </svg>
               Refresh
             </button>
           </div>
        )}

        {/* Loading / Error */}
        {loading && <p className="text-center text-gray-500">Loading...</p>}
        {error && <p className="text-center text-red-500 text-sm">{error}</p>}

        {/* Results */}
        {busData && (
          <div className="border-t pt-4">
             <h2 className="text-lg font-semibold mb-2">Route: {routeNo}</h2>
             <div className="space-y-2">
                {/* 
                   We need to display the list of stops.
                   If we have bus locations, we should mark them.
                   Since busInfo structure is unknown (empty in debug), 
                   we will list all stops and list any buses at the top if unmatchable.
                */}
                
                {/* Active Buses Summary */}
                {busData.buses.length > 0 ? (
                    <div className="bg-green-50 p-2 rounded mb-2 text-sm text-green-800">
                        {busData.buses.length} Active Buses Found.
                        {/* Try to dump bus info if available */}
                        <pre className="text-xs overflow-auto max-h-20">{JSON.stringify(busData.buses, null, 2)}</pre>
                    </div>
                ) : (
                    <div className="bg-yellow-50 p-2 rounded mb-2 text-sm text-yellow-800">
                        No active buses found (or API restriction).
                    </div>
                )}

                {/* Stop List */}
                {/* Timeline Container - Increased left margin to make room for buses on the left */}
                <ul className="relative border-l-2 border-gray-300 ml-24 space-y-10 pb-4">
                  {busData.stops.map((stop, fileIndex) => (
                    <li key={stop.busstopcode || fileIndex} className="relative pl-6">
                        {/* Station Dot */}
                        <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${
                            stop.buses.some(b => b.status === '1') ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
                        }`}></div>
                        
                        {/* 
                            Arrived Buses (Status 1)
                            Positioned to the LEFT of the timeline (Line is at left:0)
                            We put them e.g. -left-20 to sit in the whitespace.
                        */}
                        {stop.buses.filter(b => b.status === '1').length > 0 && (
                             <div className="absolute top-0 -left-24 w-20 flex flex-col items-end gap-1 z-20 transform -translate-y-1">
                                {stop.buses.filter(b => b.status === '1').map((bus, bi) => (
                                    <div key={bi} className="flex flex-col items-end gap-1 z-20">
                                        {/* Plate Pill */}
                                        <div className="bg-red-500 text-white text-xs px-2 py-1 rounded shadow-sm font-bold flex items-center gap-1 justify-end">
                                            <span className="truncate">{bus.busPlate}</span>
                                            <span>🛑</span>
                                        </div>
                                        {/* Bus Type for Arrived */}
                                        {bus.busType && (
                                            <div className="text-[9px] bg-red-100 text-red-800 border border-red-200 px-1.5 rounded-full shadow-sm">
                                                {getBusTypeLabel(bus.busType)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                             </div>
                        )}

                        {/* Stop Info */}
                        <div className={`flex flex-col items-start transition-all`}>
                             <div className="text-sm font-bold text-gray-800">{orderIndex(fileIndex)} {stop.staName}</div>
                             <div className="text-xs text-gray-400">{stop.staCode}</div>
                        </div>


                        {/* 
                            Moving Buses (Status 0)
                            Positioned BETWEEN stops, LEFT of the line.
                            Roughly centered between this and prev stop (visually above).
                        */}
                        {stop.buses.filter(b => b.status === '0').map((bus, bi) => (
                            <div key={bi} className="absolute -top-5 -left-24 w-20 flex justify-end z-0 transform -translate-y-1/2">
                                <div className="flex flex-col items-end gap-1">
                                     {/* Bus Pill with Speed */}
                                     <div className="bg-white border border-teal-500 text-teal-700 text-xs px-2 py-1 rounded-full shadow-sm flex items-center gap-1 overflow-hidden whitespace-nowrap">
                                         <span className="font-bold">{bus.busPlate}</span>
                                         <span>🚌</span>
                                         {/* <span className="text-[9px]">{bus.speed}km</span> */}
                                     </div>
                                     
                                     {/* Bus Type Label for Moving */}
                                     {bus.busType && (
                                         <div className="text-[9px] bg-teal-100 text-teal-800 border border-teal-200 px-1.5 rounded-full shadow-sm">
                                             {getBusTypeLabel(bus.busType)}
                                         </div>
                                     )}
                                </div>
                            </div>
                        ))}
                    </li>
                  ))}
                </ul>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper for 1-based index
const orderIndex = (i) => i + 1 + ".";

export default App;
