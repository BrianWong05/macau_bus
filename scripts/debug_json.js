import axios from 'axios';
import md5 from 'js-md5';
import https from 'https';

const generateDsatToken = (params) => {
  let queryString = "";
  // Sort keys? JS map usually not sorted. But standard practice?
  // vendors.js loop: Object.keys(t).map...
  // It uses key order of the object passed.
  
  Object.keys(params).forEach((key, index) => {
      queryString += (index === 0 ? "" : "&") + key + "=" + params[key];
  });
  
  console.log("Query String to Hash:", queryString);
  
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

async function testJsonApi(routeNo, dir) {
  console.log(`\nTesting JSON API (getRouteData): Route=${routeNo}, Dir=${dir}`);
  
  const params = {
      routeName: routeNo,
      dir: dir, // Dynamic dir
      lang: 'zh-tw',
      device: 'web'
  };
  
  const token = generateDsatToken(params);
  const body = new URLSearchParams(params).toString();

  try {
    const response = await axios.post('https://bis.dsat.gov.mo:37812/macauweb/getRouteData.html', body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://bis.dsat.gov.mo:37812/macauweb/',
        'token': token
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    console.log("Status:", response.status);
    const data = response.data.data;
    if (data) {
        // Print EVERYTHING to find routeType
        console.log("Full Data Keys:", Object.keys(data));
        console.log("Full Data Dump:", JSON.stringify(data, null, 2));
    } else {
        console.log("Data is null/empty");
    }

  } catch (error) {
    console.error("Request Failed:", error.message);
  }
}

async function testRealtime(routeCode, dir) {
  console.log(`\nTesting Realtime API (routestation/bus): Code=${routeCode}, Dir=${dir}`);
  
  const params = {
      routeCode: routeCode,
      dir: dir,
      device: 'web',
      lang: 'zh-tw'
  };
  
  const token = generateDsatToken(params);
  const body = new URLSearchParams(params).toString();

  try {
    const response = await axios.post('https://bis.dsat.gov.mo:37812/macauweb/routestation/bus', body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://bis.dsat.gov.mo:37812/macauweb/',
        'token': token
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    console.log("Status:", response.status);
    console.log("Full Response Data:", JSON.stringify(response.data));

  } catch (error) {
    console.error("Realtime Request Failed:", error.message);
  }
}

async function run() {
    await testJsonApi("33", "0");
}

run();
