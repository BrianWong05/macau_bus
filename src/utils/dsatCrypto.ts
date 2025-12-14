
import { md5 } from 'js-md5';

// Reverse-engineered Token Logic
export const generateDsatToken = (params: Record<string, any>) => {
    let queryString = "";
    Object.keys(params).forEach((key, index) => {
        queryString += (index === 0 ? "" : "&") + key + "=" + params[key];
    });
    
    const dirtyHash = md5(queryString);
    const date = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
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
