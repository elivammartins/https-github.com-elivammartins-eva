
export interface RouteData {
  geometry: any;
  distance: number;
  duration: number;
  steps: any[];
}

export async function fetchRoute(start: [number, number], end: [number, number]): Promise<RouteData | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.code === 'Ok' && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        steps: route.legs[0].steps
      };
    }
  } catch (error) {
    console.error("Erro no serviço de navegação:", error);
  }
  return null;
}
