import { MapCore } from './map_core.js';
import { WindVizLayer } from './viz_wind.js';

const App = {
    // Konfiguracja
    config: {
        dataPath: 'api/wind/data.json'
    },

    async init() {
        console.log("🚀 Aplikacja startuje...");
        
        // 1. Inicjalizacja Mapy
        MapCore.init('main-map');

        // 2. Ładowanie danych
        await this.loadWindModule();
    },

    async loadWindModule() {
        const statusEl = document.getElementById('data-status');
        
        try {
            statusEl.innerText = "Pobieranie danych...";
            
            // Cache busting (dodanie timestampu) aby nie ładować starych danych
            const response = await fetch(`${this.config.dataPath}?t=${Date.now()}`);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            // 3. Tworzenie warstwy wizualizacji
            const windViz = new WindVizLayer(data);
            const layer = windViz.create();
            
            // 4. Dodanie do mapy
            MapCore.setLayer(layer);
            
            // 5. Centrowanie mapy na danych
            if (data.bounds) {
                MapCore.fitBounds(data.bounds);
            }

            // 6. Aktualizacja UI
            this.updateUI(data);

        } catch (error) {
            console.error("❌ Błąd:", error);
            statusEl.innerText = "Błąd danych";
            statusEl.style.color = "#ef4444";
        }
    },

    updateUI(data) {
        document.getElementById('data-status').innerText = "Aktywny";
        document.getElementById('active-module').innerText = "Symulacja Wiatru (CFD)";
        
        if (data.meta && data.meta.timestamp) {
            const date = new Date(data.meta.timestamp * 1000);
            document.getElementById('update-time').innerText = date.toLocaleTimeString();
        }
    }
};

// Uruchomienie po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => App.init());
