export const MapCore = {
    map: null,
    currentLayer: null,

    init(divId) {
        if (this.map) return; // Zapobieganie podwójnej inicjalizacji

        // Inicjalizacja mapy (Warszawa domyślnie)
        this.map = L.map(divId, {
            zoomControl: false,
            attributionControl: false
        }).setView([52.23, 21.01], 13);

        // Dodanie ciemnego podkładu (CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap, © CartoDB',
            maxZoom: 19
        }).addTo(this.map);

        // Kontrolka zoom w prawym dolnym rogu
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    },

    setLayer(leafletLayer) {
        // Usuń poprzednią warstwę jeśli istnieje
        if (this.currentLayer) {
            this.map.removeLayer(this.currentLayer);
        }
        
        // Dodaj nową
        if (leafletLayer) {
            this.currentLayer = leafletLayer;
            this.currentLayer.addTo(this.map);
        }
    },

    fitBounds(bounds) {
        // bounds w formacie [[lat, lng], [lat, lng]]
        if (bounds) {
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
};
