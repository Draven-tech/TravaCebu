import { Injectable } from '@angular/core';
import { BudgetService } from './budget.service';

export interface ItineraryExpensePlanInput {
  transportation?: number;
  food?: number;
  accommodation?: number;
  estimates?: {
    transportation: number;
    food: number;
    accommodation: number;
  };
}

/**
 * Maps itinerary completion to budget expense rows (transport / food / stay).
 */
@Injectable({
  providedIn: 'root',
})
export class ItineraryExpenseSyncService {
  constructor(private budgetService: BudgetService) {}

  async persistItineraryExpenses(
    itinerary: any,
    expensePlan: ItineraryExpensePlanInput | undefined,
    routeSegments: any[] | null | undefined
  ): Promise<void> {
    if (!itinerary) {
      return;
    }

    const resolvedPlan = this.resolveExpensePlan(itinerary, expensePlan, routeSegments);
    const itineraryId = itinerary.id || `itinerary_${itinerary.date || Date.now()}`;
    const itineraryDate =
      itinerary.date || this.extractDateFromStart(itinerary.start) || this.getLocalDateString(new Date());
    const allExpenses = await this.budgetService.getExpenses();

    await this.upsertExpenseCategory(
      allExpenses,
      'transportation',
      resolvedPlan.transportation,
      itineraryId,
      itineraryDate,
      `Transportation for ${itinerary.name || itineraryDate}`
    );

    await this.upsertExpenseCategory(
      allExpenses,
      'food',
      resolvedPlan.food,
      itineraryId,
      itineraryDate,
      `Food for ${itinerary.name || itineraryDate}`
    );

    await this.upsertExpenseCategory(
      allExpenses,
      'accommodation',
      resolvedPlan.accommodation,
      itineraryId,
      itineraryDate,
      `Accommodation for ${itinerary.name || itineraryDate}`
    );
  }

  private async upsertExpenseCategory(
    allExpenses: any[],
    category: 'transportation' | 'food' | 'accommodation',
    amount: number,
    itineraryId: string,
    itineraryDate: string,
    description: string
  ): Promise<void> {
    if (!amount || amount <= 0) {
      return;
    }

    const existing = allExpenses.find(
      (expense: any) =>
        expense.category === category &&
        (expense.itineraryId === itineraryId || this.getLocalDateString(expense.date) === itineraryDate)
    );

    if (existing?.id) {
      await this.budgetService.updateExpense(existing.id, {
        amount,
        description,
        date: new Date(`${itineraryDate}T12:00:00`),
        itineraryId,
        dayNumber: 1,
      });
      return;
    }

    if (category === 'transportation') {
      await this.budgetService.addTransportationExpense(amount, description, undefined, itineraryId, 1);
      return;
    }

    if (category === 'food') {
      await this.budgetService.addFoodExpense(amount, 'Itinerary Meals', 'Food', itineraryId, 1);
      return;
    }

    await this.budgetService.addAccommodationExpense(amount, 'Itinerary Stay', 1, itineraryId, 1);
  }

  private resolveExpensePlan(
    itinerary: any,
    expensePlan: ItineraryExpensePlanInput | undefined,
    routeSegments: any[] | null | undefined
  ): { transportation: number; food: number; accommodation: number } {
    const defaults = this.computeDefaultExpensePlan(itinerary, routeSegments);

    const transportation =
      expensePlan?.transportation === null ||
      expensePlan?.transportation === undefined ||
      isNaN(Number(expensePlan?.transportation))
        ? defaults.transportation
        : Math.max(0, Number(expensePlan.transportation));

    const food =
      expensePlan?.food === null || expensePlan?.food === undefined || isNaN(Number(expensePlan?.food))
        ? defaults.food
        : Math.max(0, Number(expensePlan.food));

    const accommodation =
      expensePlan?.accommodation === null ||
      expensePlan?.accommodation === undefined ||
      isNaN(Number(expensePlan?.accommodation))
        ? defaults.accommodation
        : Math.max(0, Number(expensePlan.accommodation));

    return { transportation, food, accommodation };
  }

  private computeDefaultExpensePlan(
    itinerary: any,
    routeSegments: any[] | null | undefined
  ): { transportation: number; food: number; accommodation: number } {
    const transportation = routeSegments?.length
      ? Math.max(0, Math.round(this.budgetService.getEstimatedJeepneyFare(routeSegments).average || 0))
      : 0;

    const hasMeals = (itinerary?.days || []).some((day: any) =>
      (day?.spots || []).some((spot: any) => !!spot?.mealType)
    );

    const nights = (itinerary?.days || []).filter((day: any) =>
      (day?.spots || []).some((spot: any) => spot?.eventType === 'hotel' || !!spot?.hotel)
    ).length;

    const limits = this.budgetService.getCurrentBudgetLimits();
    const dayCount = Math.max(1, itinerary?.days?.length || 1);

    return {
      transportation,
      food: hasMeals ? Math.max(0, Math.round((limits?.dailyFood || 0) * dayCount)) : 0,
      accommodation: nights > 0 ? Math.max(0, Math.round((limits?.dailyAccommodation || 0) * nights)) : 0,
    };
  }

  private getLocalDateString(value: any): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      const datePart = value.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }
    }

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private extractDateFromStart(start?: string): string {
    if (!start) {
      return '';
    }
    const datePart = start.split('T')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : '';
  }
}
