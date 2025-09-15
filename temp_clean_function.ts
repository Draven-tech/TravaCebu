  private async findBestJeepneyRoute(from: any, to: any): Promise<any> {
    console.log('🔍 findBestJeepneyRoute called');
    console.log('📍 From:', from);
    console.log('📍 To:', to);
    
    // Extract coordinates from the 'to' object (spot)
    let toCoords = to;
    if (to.location && to.location.lat && to.location.lng) {
      toCoords = { lat: to.location.lat, lng: to.location.lng };
      console.log('✅ Extracted coordinates from to.location:', toCoords);
    } else if (to.lat && to.lng) {
      toCoords = { lat: to.lat, lng: to.lng };
      console.log('✅ Extracted coordinates from to:', toCoords);
    } else {
      console.log('❌ No valid coordinates found in to object');
      return null;
    }

    // STAGE 1 ONLY: Direct Google Directions API call
    try {
      console.log('🚌 Calling Google Directions API for transit routes...');
      const response: any = await this.directionsService.getDirections(
        `${from.lat},${from.lng}`,
        `${toCoords.lat},${toCoords.lng}`,
        undefined,
        'transit'
      ).toPromise();

      console.log('📥 Google Directions API response:', response);
      console.log('📥 Response type:', typeof response);
      console.log('📥 Response keys:', Object.keys(response || {}));
      console.log('📥 Response status:', response?.status);
      console.log('📥 Response routes:', response?.routes?.length || 0);

      if (response && response.routes && response.routes.length > 0) {
        const route = response.routes[0];
        console.log('✅ Found route with legs:', route.legs?.length || 0);
        console.log('📋 Route structure:', {
          hasLegs: !!route.legs,
          legsCount: route.legs?.length || 0,
          hasOverviewPolyline: !!route.overview_polyline,
          hasSummary: !!route.summary
        });
        
        // Extract jeepney information from the transit route
        const jeepneySegments: any[] = [];
        let totalDistance = 0;
        
        if (route.legs) {
          route.legs.forEach((leg: any, legIndex: number) => {
            console.log(`🦵 Processing leg ${legIndex + 1}:`, leg.steps?.length || 0, 'steps');
            console.log(`🦵 Leg structure:`, {
              hasSteps: !!leg.steps,
              stepsCount: leg.steps?.length || 0,
              hasDuration: !!leg.duration,
              hasDistance: !!leg.distance
            });
            
            if (leg.steps) {
              leg.steps.forEach((step: any, stepIndex: number) => {
                console.log(`👣 Step ${stepIndex + 1}: ${step.travel_mode}`);
                console.log(`👣 Step structure:`, {
                  travelMode: step.travel_mode,
                  hasTransitDetails: !!step.transit_details,
                  hasStartLocation: !!step.start_location,
                  hasEndLocation: !!step.end_location
                });
                
                if (step.travel_mode === 'TRANSIT' && step.transit_details) {
                  const transit = step.transit_details;
                  const line = transit.line;
                  
                  console.log('🚌 Transit details:', {
                    lineName: line?.name,
                    shortName: line?.short_name,
                    vehicleType: line?.vehicle?.type,
                    departureStop: transit.departure_stop?.name,
                    arrivalStop: transit.arrival_stop?.name
                  });
                  
                  // Check if it's a jeepney (bus) route - be more flexible
                  if (line && (
                    line.vehicle?.type === 'BUS' || 
                    line.name?.toLowerCase().includes('jeepney') ||
                    line.short_name?.match(/^\d+[A-Z]?$/) || // Route codes like "12A", "13B", etc.
                    line.name?.match(/^\d+[A-Z]?$/) ||
                    line.short_name?.length <= 4 // Short route codes
                  )) {
                    const jeepneySegment = {
                      type: 'jeepney',
                      jeepneyCode: line.short_name || line.name || 'Unknown',
                      routeName: line.name || 'Jeepney Route',
                      from: step.start_location,
                      to: step.end_location,
                      distance: step.distance?.value || 0,
                      duration: step.duration?.value || 0,
                      description: `Take jeepney ${line.short_name || line.name} from ${transit.departure_stop?.name} to ${transit.arrival_stop?.name}`
                    };
                    jeepneySegments.push(jeepneySegment);
                    totalDistance += step.distance?.value || 0;
                    console.log('✅ Added jeepney segment:', jeepneySegment);
                  } else {
                    console.log('⚠️ Transit step not recognized as jeepney:', line);
                  }
                } else if (step.travel_mode === 'WALKING') {
                  const walkingSegment = {
                    type: 'walking',
                    from: step.start_location,
                    to: step.end_location,
                    distance: step.distance?.value || 0,
                    duration: step.duration?.value || 0,
                    description: `Walk ${Math.round((step.distance?.value || 0) / 1000 * 100) / 100}km`
                  };
                  jeepneySegments.push(walkingSegment);
                  console.log('🚶 Added walking segment:', walkingSegment);
                }
              });
            }
          });
        }

        // Check if we found any jeepney segments
        const jeepneySegmentsFound = jeepneySegments.filter(s => s.type === 'jeepney');
        console.log('🔍 Found jeepney segments:', jeepneySegmentsFound.length);
        
        if (jeepneySegmentsFound.length > 0) {
          const result = {
            type: 'google_transit_route',
            segments: jeepneySegments,
            totalDistance: totalDistance,
            totalDuration: route.legs?.reduce((total: number, leg: any) => total + (leg.duration?.value || 0), 0) || 0,
            polyline: route.overview_polyline?.points
          };
          console.log('✅ Returning jeepney route result:', result);
          return result;
        } else {
          console.log('❌ No jeepney segments found in Google response');
        }
      } else {
        console.log('❌ No routes found in Google Directions response');
      }
    } catch (error) {
      console.error('❌ Error calling Google Directions API:', error);
    }

    // If no jeepney routes found, return null (will default to walking)
    console.log('❌ No jeepney route found, returning null');
    return null;
  }


