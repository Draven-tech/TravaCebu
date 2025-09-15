  private findSingleRideRoute(from: any, to: any): any {
    let bestRoute = null;
    let bestScore = Infinity;

    for (const route of this.jeepneyRoutes) {
      if (!route.stops || !Array.isArray(route.stops) || route.stops.length === 0) {
        continue;
      }

      // Find nearest stops to origin and destination
      const fromStop = this.findNearestStop(from, route.stops);
      const toStop = this.findNearestStop(to, route.stops);

      if (fromStop && toStop) {
        // Calculate route distance and score
        const routeDistance = this.getRouteDistance(route, fromStop, toStop);
        const walkDistance = fromStop.distance + toStop.distance;
        const totalDistance = routeDistance + walkDistance;
        
        // Score based on total distance (lower is better)
        const score = totalDistance;
        
        if (score < bestScore) {
          bestScore = score;
          bestRoute = {
            route: route,
            fromStop: fromStop,
            toStop: toStop,
            routeDistance: routeDistance,
            walkDistance: walkDistance,
            totalDistance: totalDistance,
            score: score
          };
        }
      }
    }

    return bestRoute;
  }


