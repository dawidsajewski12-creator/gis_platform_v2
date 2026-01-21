export class WindVizLayer {
    constructor(data) {
        this.data = data;
        this.particles = [];
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.map = null;
    }

    create() {
        // Tworzymy Custom Layer w Leaflet
        const layer = L.Layer.extend({
            onAdd: (map) => {
                this.map = map;
                this.canvas = L.DomUtil.create('canvas', 'wind-canvas');
                this.canvas.style.pointerEvents = 'none'; // Mapa musi reagować pod spodem
                
                // Ustaw rozmiar
                const size = map.getSize();
                this.canvas.width = size.x;
                this.canvas.height = size.y;
                
                map.getPanes().overlayPane.appendChild(this.canvas);
                this.ctx = this.canvas.getContext('2d');

                // Inicjalizacja cząsteczek
                this._initParticles();
                
                // Start pętli animacji
                this._animate();

                // Eventy: przesuwanie mapy
                map.on('moveend zoomend', this._reset, this);
            },

            onRemove: (map) => {
                cancelAnimationFrame(this.animationId);
                L.DomUtil.remove(this.canvas);
                map.off('moveend zoomend', this._reset, this);
            }
        });

        return new layer();
    }

    _reset() {
        // Reset po przesunięciu mapy
        if (!this.map || !this.canvas) return;
        
        const topLeft = this.map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this.canvas, topLeft);

        const size = this.map.getSize();
        this.canvas.width = size.x;
        this.canvas.height = size.y;
        
        this._initParticles();
    }

    _initParticles() {
        // Tworzymy cząsteczki na podstawie danych JSON
        // Zakładamy strukturę danych: [{lat, lng, u, v}, ...]
        this.particles = [];
        const bounds = this.map.getBounds();

        this.data.particles.forEach(p => {
            // Filtrujemy tylko te w widoku (optymalizacja)
            if (bounds.contains([p.lat, p.lng])) {
                const point = this.map.latLngToContainerPoint([p.lat, p.lng]);
                this.particles.push({
                    x: point.x,
                    y: point.y,
                    origX: point.x,
                    origY: point.y,
                    vx: p.u * 1.5, // Skalowanie prędkości
                    vy: -p.v * 1.5, // Y w Canvas jest odwrotne
                    age: Math.random() * 100
                });
            }
        });
    }

    _animate() {
        if (!this.ctx) return;
        
        // Efekt smugi (fade effect)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; 
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#38bdf8'; // Kolor cząsteczek

        this.particles.forEach(p => {
            // Ruch
            p.x += p.vx;
            p.y += p.vy;
            p.age++;

            // Rysowanie
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            this.ctx.fill();

            // Reset cząsteczki po czasie lub wyjściu poza kadr
            if (p.age > 60) {
                p.x = p.origX;
                p.y = p.origY;
                p.age = 0;
            }
        });

        this.animationId = requestAnimationFrame(() => this._animate());
    }
}
