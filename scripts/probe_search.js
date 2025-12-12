import axios from 'axios';
import jsMd5 from 'js-md5';

// Mock Browser Environment for axios if needed (node doesn't need it)

const generateDsatToken = (params, sort = false) => {
    let queryString = "";
    const keys = sort ? Object.keys(params).sort() : Object.keys(params);
    
    keys.forEach((key, index) => {
        queryString += (index === 0 ? "" : "&") + key + "=" + params[key];
    });
    
    console.log(`[Token Gen] Sort=${sort} | Query: ${queryString}`);

    const dirtyHash = jsMd5(queryString);
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

const probe = async (label, params, sort) => {
    console.log(`\n--- Probing: ${label} ---`);
    const token = generateDsatToken(params, sort);
    const qs = new URLSearchParams(params).toString();
    const url = "https://bis.dsat.gov.mo:37812/macauweb/getRouteData.html"; 
    // Direct URL might fail due to CORS if in browser, but in Node it might fail if they block non-browser UAs or IP.
    // They accept direct calls usually if Origin/Referer is set? 
    // The previous script check_location_api.js used direct URL.

    try {
        const res = await axios.post(url, qs, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'token': token,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // Add Origin/Referer if needed
                'Origin': 'https://bis.dsat.gov.mo:37812',
                'Referer': 'https://bis.dsat.gov.mo:37812/macauweb/routestation/bus'
            },
            timeout: 5000
        });
        console.log(`Status: ${res.status}`);
        if(res.data && res.data.data) {
             console.log(`Result: SUCCESS. RouteName: ${res.data.data.routeCode}`);
             if (res.data.data.routeInfo && res.data.data.routeInfo.length > 0) {
                 console.log("Sample Stop:", res.data.data.routeInfo[0]);
             }
        } else {
             console.log(`Result: EMPTY/FAIL.`, res.data);
        }
    } catch (e) {
        console.log(`Result: ERROR ${e.message}`);
    }
};

const run = async () => {
    // Case 1: Original App.jsx params (No request_id, No sort)
    await probe("Original Params (Unsorted)", {
        routeName: '33',
        dir: '0',
        lang: 'zh-tw',
        device: 'web'
    }, false);

    // Case 2: Sorted Params
    await probe("Original Params (Sorted)", {
        routeName: '33',
        dir: '0',
        lang: 'zh-tw',
        device: 'web'
    }, true);

    // Case 3: With request_id (Unsorted)
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const request_id = `${yyyy}${mm}${dd}${hh}${min}${ss}`;

    await probe("With request_id (Unsorted)", {
        routeName: '33',
        dir: '0',
        lang: 'zh-tw',
        device: 'web',
        request_id: request_id
    }, false);
    
    // Case 5: device=android
    await probe("Device=android (Unsorted)", {
        routeName: '33',
        dir: '0',
        lang: 'zh-tw',
        device: 'android'
    }, false);
};

run();
