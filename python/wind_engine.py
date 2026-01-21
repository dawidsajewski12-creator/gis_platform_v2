import numpy as np
import time
from numba import njit

# --- KERNEL OBLICZENIOWY (LBM) ---
@njit(fastmath=True)
def lbm_solver(mask, u_wind, v_wind, nx, ny, iterations=1000):
    # Stałe LBM D2Q9
    w = np.array([4/9, 1/9, 1/9, 1/9, 1/9, 1/36, 1/36, 1/36, 1/36])
    cx = np.array([0, 1, 0, -1, 0, 1, -1, -1, 1])
    cy = np.array([0, 0, 1, 0, -1, 1, 1, -1, -1])
    
    # Inicjalizacja gęstości (rho) i funkcji rozkładu (f)
    rho = np.ones((ny, nx))
    f = np.zeros((ny, nx, 9))
    
    # Stan początkowy (równowaga)
    u_sq = u_wind**2 + v_wind**2
    for k in range(9):
        cu = u_wind * cx[k] + v_wind * cy[k]
        f[:, :, k] = rho * w[k] * (1 + 3*cu + 4.5*cu**2 - 1.5*u_sq)

    # Bufor tymczasowy do streamingu (aby uniknąć nadpisywania danych)
    f_new = np.zeros((ny, nx))

    # Pętla symulacji
    for _ in range(iterations):
        
        # 1. STREAMING (Przesuwanie cząsteczek)
        # Zamiast np.roll (który sprawia błędy w Numbie), używamy jawnych pętli.
        # Numba kompiluje to do super-szybkiego kodu maszynowego.
        for k in range(9):
            shift_x = cx[k]
            shift_y = cy[k]
            
            # Reset bufora
            f_new[:] = 0.0
            
            # Ręczne przesuwanie z zawijaniem (periodic boundary)
            # Pythonowe % działa poprawnie dla liczb ujemnych (np. -1 % 200 = 199)
            for y in range(ny):
                target_y = (y + shift_y) % ny
                for x in range(nx):
                    target_x = (x + shift_x) % nx
                    f_new[target_y, target_x] = f[y, x, k]
            
            # Przepisanie wyniku z powrotem do f
            f[:, :, k] = f_new

        # 2. Collision (BGK)
        rho = np.sum(f, axis=2)
        # Zabezpieczenie przed dzieleniem przez zero (choć rho ~ 1.0)
        inv_rho = 1.0 / rho
        
        ux = np.sum(f * cx, axis=2) * inv_rho
        uy = np.sum(f * cy, axis=2) * inv_rho
        
        # Wymuszanie wiatru na lewej krawędzi (inflow boundary)
        ux[:, 0] = u_wind
        uy[:, 0] = v_wind

        # Relaksacja do równowagi
        omega = 1.2 # Parametr lepkości
        u_sq = ux**2 + uy**2
        
        for k in range(9):
            cu = ux * cx[k] + uy * cy[k]
            f_eq = rho * w[k] * (1 + 3*cu + 4.5*cu**2 - 1.5*u_sq)
            f[:, :, k] += omega * (f_eq - f[:, :, k])
            
        # 3. Obsługa przeszkód (Boundary conditions)
        for y in range(ny):
            for x in range(nx):
                if mask[y, x] > 0:
                    ux[y, x] = 0
                    uy[y, x] = 0
                    # Prosty bounce-back (reset prędkości w przeszkodzie)

    return ux, uy

# --- GŁÓWNY RUNNER ---
def run_simulation(mask_array, params, geo_transform):
    """
    Przyjmuje:
    - mask_array: numpy array (0 = powietrze, 1 = budynek)
    - params: słownik {wind_speed, wind_dir, iterations}
    - geo_transform: funkcja do zamiany pixeli na lat/lng
    
    Zwraca: Słownik gotowy do zapisu jako JSON
    """
    ny, nx = mask_array.shape
    
    # 1. Konwersja wiatru
    rad = np.deg2rad(270 - params['wind_dir']) 
    u_in = params['wind_speed'] * np.cos(rad) * 0.1 
    v_in = params['wind_speed'] * np.sin(rad) * 0.1
    
    # 2. Obliczenia
    print(f"🌪️ Obliczenia LBM start: {nx}x{ny}, iteracje: {params['iterations']}")
    start_t = time.time()
    
    # Wywołanie funkcji
    ux, uy = lbm_solver(mask_array, u_in, v_in, nx, ny, params['iterations'])
    
    print(f"✅ Koniec obliczeń w {time.time() - start_t:.2f}s")
    
    # 3. Ekstrakcja danych (decymacja - bierzemy co 10 punkt)
    stride = 10
    particles = []
    
    for y in range(0, ny, stride):
        for x in range(0, nx, stride):
            if mask_array[y, x] == 0: 
                lat, lng = geo_transform(x, y)
                speed = np.sqrt(ux[y,x]**2 + uy[y,x]**2)
                
                if speed > 0.001:
                    particles.append({
                        "lat": round(lat, 6),
                        "lng": round(lng, 6),
                        "u": round(float(ux[y,x]), 4),
                        "v": round(float(uy[y,x]), 4)
                    })

    # 4. Obliczanie granic (bounds)
    if particles:
        lats = [p['lat'] for p in particles]
        lngs = [p['lng'] for p in particles]
        bounds = [[min(lats), min(lngs)], [max(lats), max(lngs)]]
    else:
        bounds = [[52.0, 21.0], [52.1, 21.1]]

    return {
        "meta": {
            "timestamp": time.time(),
            "params": params,
            "count": len(particles)
        },
        "bounds": bounds,
        "particles": particles
    }
