  private findMultiRideRoute(from: any, to: any): any {
    let bestRoute = null;
    let bestScore = Infinity;

    // Try all combinations of 2 routes (1 transfer)
    for (const route1 of this.jeepneyRoutes) {
      if (!route1.stops || !Array.isArray(route1.stops) || route1.stops.length === 0) {
        continue;
      }

      for (const route2 of this.jeepneyRoutes) {
        if (route1 === route2 || !route2.stops || !Array.isArray(route2.stops) || route2.stops.length === 0) {
          continue;
        }

        // Find nearest stops for route1 (from origin)
        const fromStop1 = this.findNearestStop(from, route1.stops);
        if (!fromStop1) continue;

        // Find nearest stops for route2 (to destination)
        const toStop2 = this.findNearestStop(to, route2.stops);
        if (!toStop2) continue;

        // Find transfer point between routes
        const transferPoint = this.findTransferPoint(route1, route2);
        if (!transferPoint) continue;

        // Calculate distances
        const walkToRoute1 = fromStop1.distance;
        const route1Distance = this.getRouteDistance(route1, fromStop1, transferPoint.route1Stop);
        const walkBetweenRoutes = transferPoint.distance;
        const route2Distance = this.getRouteDistance(route2, transferPoint.route2Stop, toStop2);
        const walkFromRoute2 = toStop2.distance;

        const totalDistance = walkToRoute1 + route1Distance + walkBetweenRoutes + route2Distance + walkFromRoute2;
        const score = totalDistance;

        if (score < bestScore) {
          bestScore = score;
          bestRoute = {
            type: 'multi_ride',
            routes: [route1, route2],
            fromStop: fromStop1,
            toStop: toStop2,
            transferPoint: transferPoint,
            walkToRoute1: walkToRoute1,
            route1Distance: route1Distance,
            walkBetweenRoutes: walkBetweenRoutes,
            route2Distance: route2Distance,
            walkFromRoute2: walkFromRoute2,
            totalDistance: totalDistance,
            score: score
          };
        }
      }
    }

    return bestRoute;
  }


