
import axios from 'axios';
import { generateDsatToken } from '@/utils/dsatCrypto';

const isDev = import.meta.env.DEV;
const BASE_URL = 'https://bis.dsat.gov.mo:37812';

// Cloudflare Worker proxy for production (bypasses CORS)
const WORKER_URL = 'https://tight-lab-4f49.wongtiniaomacau.workers.dev';

// Helper: wrap URL with proxy in production
const proxyUrl = (path: string) => {
  const fullUrl = `${BASE_URL}${path}`;
  return isDev ? path : `${WORKER_URL}/?url=${encodeURIComponent(fullUrl)}`;
};

// 1. Fetch Route List (Stops)
export const fetchRouteDataApi = async (rNo: string, dir: string) => {
    const params = {
        routeName: rNo,
        dir: dir,
        lang: 'zh-tw',
        device: 'web'
    };

    const token = generateDsatToken(params);
    const qs = new URLSearchParams(params).toString();
    
    const targetUrl = proxyUrl('/macauweb/getRouteData.html');

    try {
            const response = await axios.post(targetUrl, qs, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'token': token
            }
        });
        return response.data;
    } catch (e) {
        console.error("Fetch Route Failed:", e);
        throw e;
    }
};

// 2. Fetch Traffic Data
export const fetchTrafficApi = async (rNoRaw: string | number, dir: string) => {
    try {
        const routeCodePadded = rNoRaw.toString().padStart(5, '0'); 
        
        const params = {
            lang: 'zh_tw', 
            routeCode: routeCodePadded,
            direction: dir,
            indexType: '00',
            device: 'web',
            categoryIds: 'BCAFBD938B8D48B0B3F598B44DD32E6C'
        };
        
        const token = generateDsatToken(params);
        const qs = new URLSearchParams(params).toString();
        
        // Use Cloudflare Worker proxy in production
        const targetUrl = proxyUrl('/ddbus/common/supermap/route/traffic');

        const response = await axios.post(targetUrl, qs, {
                 headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'token': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                 }
             }
        );
        
        if (response.data && Array.isArray(response.data.data)) {
             const dataList = response.data.data;
             // Map data to segments
             const segments = dataList.map((item: any) => {
                 let coords = [];
                 if (item.routeCoordinates) {
                     coords = item.routeCoordinates.split(';').filter((s: string) => s).map((pair: string) => {
                         const [lon, lat] = pair.split(',');
                         return [parseFloat(lat), parseFloat(lon)];
                     });
                 }
                 return {
                     traffic: item.newRouteTraffic || item.routeTraffic,
                     path: coords,
                     stationCode: item.stationCode || item.stopCode || item.staCode
                 };
             });
             return segments;
        }
        return [];
    } catch (e) {
        console.error("Traffic Fetch Error:", e);
        return [];
    }
};

// 3. Fetch Realtime Bus (List View)
// Returns nested object { type: '0', data: ... } or error
export const fetchBusListApi = async (rNo: string, dir: string, routeType: string) => {
      const params = {
          action: 'dy',
          routeName: rNo,
          dir: dir,
          lang: 'zh-tw',
          routeType: routeType,
          device: 'web'
      };
      const token = generateDsatToken(params);
      
      // Use Cloudflare Worker proxy in production
      const targetUrl = proxyUrl('/macauweb/routestation/bus');

      try {
          const res = await axios.post(targetUrl, 
              new URLSearchParams(params).toString(), 
              { 
                  headers: { 
                      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                      'token': token
                  } 
              }
          );
          return { type: routeType, data: res.data };
      } catch (err) {
          return { type: routeType, error: err };
      }
};

// 4. Fetch Map Location (GPS)
export const fetchMapLocationApi = async (rNo: string, dir: string) => {
      const routeCodePadded = rNo.trim().toString().padStart(5, '0');
      
      const params = {
          routeName: rNo.trim(),
          dir: dir,
          lang: 'zh-tw',
          routeCode: routeCodePadded
      };
      const token = generateDsatToken(params);

      // Use Cloudflare Worker proxy in production
      const url = proxyUrl('/macauweb/routestation/location');
      
      // Use GET request with params in URL to avoid Error 1200 (Invalid Session/Method)
      const qs = new URLSearchParams(params).toString();
      const finalUrl = `${url}?${qs}&t=${Date.now()}`;

      try {
        const res = await axios.get(finalUrl, {
            headers: {
                'token': token,
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json, text/javascript, */*; q=0.01'
            }
        });
        return res.data;
      } catch (e) {
          throw e;
      }
};
