import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from './auth.service';

export interface BudgetExpense {
  id: string;
  category: 'transportation' | 'food' | 'accommodation';
  amount: number;
  description: string;
  date: Date;
  location?: string;
  itineraryId?: string;
  dayNumber?: number | null;
  spotName?: string;
  restaurantName?: string;
  hotelName?: string;
  jeepneyCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetSummary {
  totalTransportation: number;
  totalFood: number;
  totalAccommodation: number;
  totalExpenses: number;
  expensesByDay: { [dayNumber: number]: BudgetExpense[] };
  expensesByCategory: { [category: string]: BudgetExpense[] };
}

export interface BudgetLimits {
  dailyTransportation: number;
  dailyFood: number;
  dailyAccommodation: number;
  totalBudget: number;
}

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private expensesSubject = new BehaviorSubject<BudgetExpense[]>([]);
  public expenses$ = this.expensesSubject.asObservable();

  private budgetLimitsSubject = new BehaviorSubject<BudgetLimits>({
    dailyTransportation: 100,
    dailyFood: 500,
    dailyAccommodation: 1500,
    totalBudget: 5000
  });
  public budgetLimits$ = this.budgetLimitsSubject.asObservable();

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService
  ) {
    this.loadExpenses();
    this.loadBudgetLimits();
  }

  // Load expenses from Firestore
  private async loadExpenses(): Promise<void> {
    try {
      const userId = await this.authService.getCurrentUid();
      if (!userId) return;

      this.firestore
        .collection('budget_expenses', ref => 
          ref.where('userId', '==', userId)
             .orderBy('date', 'desc')
        )
        .valueChanges({ idField: 'id' })
        .subscribe((expenses: any[]) => {
          const formattedExpenses = expenses.map(expense => ({
            ...expense,
            date: expense.date?.toDate() || new Date(),
            createdAt: expense.createdAt?.toDate() || new Date(),
            updatedAt: expense.updatedAt?.toDate() || new Date()
          }));
          this.expensesSubject.next(formattedExpenses);
        });
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  }

  // Load budget limits from Firestore
  private async loadBudgetLimits(): Promise<void> {
    try {
      const userId = await this.authService.getCurrentUid();
      if (!userId) return;

      const doc = await this.firestore
        .collection('budget_limits')
        .doc(userId)
        .get()
        .toPromise();

      if (doc?.exists) {
        const limits = doc.data() as BudgetLimits;
        this.budgetLimitsSubject.next(limits);
      }
    } catch (error) {
      console.error('Error loading budget limits:', error);
    }
  }

  // Add a new expense
  async addExpense(expense: Omit<BudgetExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const userId = await this.authService.getCurrentUid();
      if (!userId) throw new Error('User not authenticated');

      const expenseData = {
        ...expense,
        userId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Remove undefined fields before saving to Firestore
      Object.keys(expenseData).forEach(key => {
        if (expenseData[key as keyof typeof expenseData] === undefined) {
          delete expenseData[key as keyof typeof expenseData];
        }
      });

      const docRef = await this.firestore
        .collection('budget_expenses')
        .add(expenseData);

      return docRef.id;
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  }

  // Update an existing expense
  async updateExpense(expenseId: string, updates: Partial<BudgetExpense>): Promise<void> {
    try {
      await this.firestore
        .collection('budget_expenses')
        .doc(expenseId)
        .update({
          ...updates,
          updatedAt: new Date()
        });
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  // Delete an expense
  async deleteExpense(expenseId: string): Promise<void> {
    try {
      await this.firestore
        .collection('budget_expenses')
        .doc(expenseId)
        .delete();
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }

  // Add transportation expense (for jeepney rides)
  async addTransportationExpense(
    amount: number,
    description: string,
    jeepneyCode?: string,
    itineraryId?: string,
    dayNumber?: number | null,
    fromSpot?: string,
    toSpot?: string
  ): Promise<string> {
    const fullDescription = jeepneyCode 
      ? `${description} (${jeepneyCode}${fromSpot && toSpot ? ` - ${fromSpot} to ${toSpot}` : ''})`
      : description;

    return this.addExpense({
      category: 'transportation',
      amount,
      description: fullDescription,
      date: new Date(),
      itineraryId,
      dayNumber,
      jeepneyCode
    });
  }

  // Add food expense (for restaurants)
  async addFoodExpense(
    amount: number,
    restaurantName: string,
    mealType: string,
    itineraryId?: string,
    dayNumber?: number | null,
    spotName?: string
  ): Promise<string> {
    const description = `${mealType} at ${restaurantName}${spotName ? ` near ${spotName}` : ''}`;

    return this.addExpense({
      category: 'food',
      amount,
      description,
      date: new Date(),
      itineraryId,
      dayNumber,
      spotName,
      restaurantName
    });
  }

  // Add accommodation expense (for hotels)
  async addAccommodationExpense(
    amount: number,
    hotelName: string,
    nights: number,
    itineraryId?: string,
    dayNumber?: number | null
  ): Promise<string> {
    const description = `${nights} night${nights > 1 ? 's' : ''} at ${hotelName}`;

    return this.addExpense({
      category: 'accommodation',
      amount,
      description,
      date: new Date(),
      itineraryId,
      dayNumber,
      hotelName
    });
  }

  // Get expenses for a specific itinerary
  getExpensesForItinerary(itineraryId: string): Observable<BudgetExpense[]> {
    return new Observable(observer => {
      this.expenses$.subscribe(expenses => {
        const itineraryExpenses = expenses.filter(expense => 
          expense.itineraryId === itineraryId
        );
        observer.next(itineraryExpenses);
      });
    });
  }

  // Get expenses for a specific day
  getExpensesForDay(dayNumber: number, itineraryId?: string): Observable<BudgetExpense[]> {
    return new Observable(observer => {
      this.expenses$.subscribe(expenses => {
        const dayExpenses = expenses.filter(expense => 
          expense.dayNumber === dayNumber && 
          (!itineraryId || expense.itineraryId === itineraryId)
        );
        observer.next(dayExpenses);
      });
    });
  }

  // Get budget summary
  getBudgetSummary(itineraryId?: string): Observable<BudgetSummary> {
    return new Observable(observer => {
      this.expenses$.subscribe(expenses => {
        const filteredExpenses = itineraryId 
          ? expenses.filter(expense => expense.itineraryId === itineraryId)
          : expenses;

        const summary: BudgetSummary = {
          totalTransportation: 0,
          totalFood: 0,
          totalAccommodation: 0,
          totalExpenses: 0,
          expensesByDay: {},
          expensesByCategory: {
            transportation: [],
            food: [],
            accommodation: []
          }
        };

        filteredExpenses.forEach(expense => {
          // Add to category totals
          switch (expense.category) {
            case 'transportation':
              summary.totalTransportation += expense.amount;
              summary.expensesByCategory['transportation'].push(expense);
              break;
            case 'food':
              summary.totalFood += expense.amount;
              summary.expensesByCategory['food'].push(expense);
              break;
            case 'accommodation':
              summary.totalAccommodation += expense.amount;
              summary.expensesByCategory['accommodation'].push(expense);
              break;
          }

          // Add to day grouping
          if (expense.dayNumber) {
            if (!summary.expensesByDay[expense.dayNumber]) {
              summary.expensesByDay[expense.dayNumber] = [];
            }
            summary.expensesByDay[expense.dayNumber].push(expense);
          }
        });

        summary.totalExpenses = summary.totalTransportation + summary.totalFood + summary.totalAccommodation;

        observer.next(summary);
      });
    });
  }

  // Update budget limits
  async updateBudgetLimits(limits: BudgetLimits): Promise<void> {
    try {
      const userId = await this.authService.getCurrentUid();
      if (!userId) throw new Error('User not authenticated');

      await this.firestore
        .collection('budget_limits')
        .doc(userId)
        .set(limits);

      this.budgetLimitsSubject.next(limits);
    } catch (error) {
      console.error('Error updating budget limits:', error);
      throw error;
    }
  }

  // Check if expense exceeds daily limit
  checkDailyLimit(category: 'transportation' | 'food' | 'accommodation', amount: number, dayNumber: number, itineraryId?: string): Observable<{ exceeds: boolean; currentTotal: number; limit: number }> {
    return new Observable(observer => {
      this.getExpensesForDay(dayNumber, itineraryId).subscribe(dayExpenses => {
        this.budgetLimits$.subscribe(limits => {
          const categoryExpenses = dayExpenses.filter(expense => expense.category === category);
          const currentTotal = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);
          
          let limit: number;
          switch (category) {
            case 'transportation':
              limit = limits.dailyTransportation;
              break;
            case 'food':
              limit = limits.dailyFood;
              break;
            case 'accommodation':
              limit = limits.dailyAccommodation;
              break;
          }

          observer.next({
            exceeds: (currentTotal + amount) > limit,
            currentTotal,
            limit
          });
        });
      });
    });
  }

  // Get estimated jeepney fare based on segments
  getEstimatedJeepneyFare(segments: any[]): number {
    let totalFare = 0;
    let jeepneyCount = 0;

    segments.forEach(segment => {
      if ((segment.type === 'jeepney' || segment.type === 'bus') && segment.jeepneyCode) {
        jeepneyCount++;
      }
    });

    // Standard jeepney fare in Cebu is ₱12-15 per ride
    const jeepneyFare = 13;
    totalFare = jeepneyCount * jeepneyFare;

    return totalFare;
  }

  // Get current expenses
  getCurrentExpenses(): BudgetExpense[] {
    return this.expensesSubject.value;
  }

  // Ensure expenses are loaded and return them
  async getExpenses(): Promise<BudgetExpense[]> {
    // If no expenses are loaded yet, wait for them to load
    if (this.expensesSubject.value.length === 0) {
      return new Promise((resolve) => {
        // Wait for the first emission of expenses
        const subscription = this.expensesSubject.subscribe(expenses => {
          if (expenses.length > 0 || subscription.closed) {
            subscription.unsubscribe();
            resolve(expenses);
          }
        });
        
        // Also set a timeout to resolve even if no expenses exist
        setTimeout(() => {
          if (!subscription.closed) {
            subscription.unsubscribe();
            resolve(this.expensesSubject.value);
          }
        }, 3000);
      });
    }
    
    return this.expensesSubject.value;
  }

  // Get current budget limits
  getCurrentBudgetLimits(): BudgetLimits {
    return this.budgetLimitsSubject.value;
  }
}
