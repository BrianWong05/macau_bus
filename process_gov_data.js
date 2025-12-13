import axios from 'axios';
import fs from 'fs';
import path from 'path';
import shp from 'shpjs';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_URL = "https://api.data.gov.mo/document/download/e7b2e84d-3333-42f0-b676-64ce95306f0d?token=OOqYZbwIyINVjc7vScWSZ7YgchW5MPXp&isNeedFile=1&lang=TC";

async function processData() {
    try {
        console.log("Downloading data from data.gov.mo...");
        const response = await axios.get(DATA_URL, {
            responseType: 'arraybuffer',
            httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
        });
        
        console.log(`Download complete. Size: ${response.data.byteLength} bytes.`);
        
        // Debug: List Zip Entries
        const zip = new AdmZip(response.data);
        const zipEntries = zip.getEntries();
        console.log("Zip Contents:");
        zipEntries.forEach(entry => console.log(" - " + entry.entryName));

        console.log("Zip Contents extracted. Checking for nested 'ExportShapeFile.zip'...");
        
        let targetBuffer = response.data;
        const innerZipEntry = zipEntries.find(e => e.entryName === "ExportShapeFile.zip");
        
        if (innerZipEntry) {
             console.log("Found nested ExportShapeFile.zip! Extracting...");
             targetBuffer = innerZipEntry.getData(); // Get buffer of inner zip
        } else {
             console.log("No nested zip found, trying outer buffer...");
        }

        console.log("Parsing Shapefiles...");
        // shpjs can parse the zip buffer directly and return an array of GeoJSONs if multiple files exist
        const geoData = await shp(targetBuffer);

        // Normalize: geoData might be a single object or array
        const files = Array.isArray(geoData) ? geoData : [geoData];

        const output = {
            stops: [],
            routes: []
        };

        files.forEach(file => {
            console.log(`Found file: ${file.fileName}`);
            
            // Heuristic to match file types
            if (file.fileName.includes("BUS_POLE")) {
                console.log(`  -> Processing Stops (${file.features.length} features)`);
                output.stops = file.features.map(f => ({
                   name: f.properties.NAME || f.properties.STATION_NA, // Adjust based on actual properties
                   code: f.properties.CODE || f.properties.STATION_CO,
                   lat: f.geometry.coordinates[1],
                   lon: f.geometry.coordinates[0],
                   raw: f.properties
                }));
            } else if (file.fileName.includes("ROUTE_NETWORK")) {
                console.log(`  -> Processing Routes (${file.features.length} features)`);
                output.routes = file.features.map(f => ({
                    routeCode: f.properties.ROUTE_CO || f.properties.CODE,
                    name: f.properties.NAME,
                    geometry: f.geometry,
                    raw: f.properties
                }));
            }
        });

        // Save
        const outDir = path.join(__dirname, 'src/data');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        
        const outFile = path.join(outDir, 'gov_data.json');
        fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
        
        console.log(`Success! Saved ${output.stops.length} stops and ${output.routes.length} route segments to ${outFile}`);

    } catch (e) {
        console.error("Processing failed:", e);
    }
}

processData();
