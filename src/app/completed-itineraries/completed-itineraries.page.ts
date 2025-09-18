import { Component, OnInit } from '@angular/core';
import { NavController, AlertController, ToastController } from '@ionic/angular';
import { CalendarService, CalendarEvent } from '../services/calendar.service';
import { BudgetService, BudgetSummary } from '../services/budget.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-completed-itineraries',
  templateUrl: './completed-itineraries.page.html',
  styleUrls: ['./completed-itineraries.page.scss'],
  standalone: false,
})
export class CompletedItinerariesPage implements OnInit {
  completedItineraries: any[] = [];
  isLoading = true;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private navCtrl: NavController,
    private calendarService: CalendarService,
    private budgetService: BudgetService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  async ngOnInit() {
    await this.loadCompletedItineraries();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async loadCompletedItineraries() {
    this.isLoading = true;
    
    try {
      // Load ALL events (including completed) from calendar service
      const allEvents = await this.calendarService.loadAllItineraryEvents();
      const completedEvents = allEvents.filter(event => event.status === 'completed');
      
      // Group completed events into itineraries
      this.completedItineraries = this.groupEventsIntoItineraries(completedEvents);
      
      for (const itinerary of this.completedItineraries) {
        // Set default values first
        itinerary.totalExpenses = 0;
        itinerary.expenseBreakdown = {
          transportation: 0,
          food: 0,
          accommodation: 0
        };
        itinerary.expenses = [];
        
        // Try to load expenses with timeout
        try {
          await Promise.race([
            this.loadItineraryExpenses(itinerary),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]);
        } catch (error) {
          // Silently skip expense loading if it fails
        }
      }
      
    } catch (error) {
      console.error('Error loading completed itineraries:', error);
      this.showToast('Failed to load completed itineraries', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  private groupEventsIntoItineraries(events: CalendarEvent[]): any[] {
    const itineraries: any[] = [];
    const groupedEvents = new Map<string, CalendarEvent[]>();

    // Group events by date
    events.forEach(event => {
      const date = event.start.split('T')[0];
      if (!groupedEvents.has(date)) {
        groupedEvents.set(date, []);
      }
      groupedEvents.get(date)!.push(event);
    });

    // Convert grouped events to itineraries
    groupedEvents.forEach((dayEvents, date) => {
      if (dayEvents.length > 0) {
        dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        
        const itinerary = {
          id: `completed_itinerary_${date}`,
          name: `Completed Trip - ${this.getDateDisplay(date)}`,
          date: date,
          completedDate: new Date(),
          totalExpenses: 0,
          expenseBreakdown: {
            transportation: 0,
            food: 0,
            accommodation: 0
          },
          days: [{
            day: 1,
            date: date,
            spots: dayEvents.map(event => ({
              name: event.title,
              type: event.extendedProps?.type || 'tourist_spot',
              timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '09:00',
              duration: event.extendedProps?.duration || '2 hours',
              location: event.extendedProps?.location,
              restaurant: event.extendedProps?.restaurant,
              hotel: event.extendedProps?.hotel,
              rating: event.extendedProps?.rating,
              vicinity: event.extendedProps?.vicinity
            }))
          }]
        };
        
        itineraries.push(itinerary);
      }
    });

    return itineraries;
  }

  private async loadItineraryExpenses(itinerary: any) {
    try {
      // Get all expenses and filter manually since getBudgetSummary might not work with our ID format
      const allExpenses = await this.budgetService.getExpenses();
      
      // Filter expenses that match this itinerary
      const matchingExpenses = allExpenses.filter(expense => {
        const matchesId = expense.itineraryId === itinerary.id;
        const matchesDate = expense.date && new Date(expense.date).toISOString().split('T')[0] === itinerary.date;
        
        // Also try to match with the original itinerary ID format (before completion)
        const originalItineraryId = itinerary.originalItineraryId || this.generateOriginalItineraryId(itinerary);
        const matchesOriginalId = expense.itineraryId === originalItineraryId;
        
        const matches = matchesId || matchesDate || matchesOriginalId;
        
        return matches;
      });
      
      // Calculate totals manually
      let totalTransportation = 0;
      let totalFood = 0;
      let totalAccommodation = 0;
      
      matchingExpenses.forEach(expense => {
        switch (expense.category) {
          case 'transportation':
            totalTransportation += expense.amount;
            break;
          case 'food':
            totalFood += expense.amount;
            break;
          case 'accommodation':
            totalAccommodation += expense.amount;
            break;
        }
      });
      
      const totalExpenses = totalTransportation + totalFood + totalAccommodation;
      
      itinerary.totalExpenses = totalExpenses;
      itinerary.expenseBreakdown = {
        transportation: totalTransportation,
        food: totalFood,
        accommodation: totalAccommodation
      };
      itinerary.expenses = matchingExpenses;
      
    } catch (error) {
      console.error('Error loading expenses for itinerary:', error);
      // Set default values on error
      itinerary.totalExpenses = 0;
      itinerary.expenseBreakdown = {
        transportation: 0,
        food: 0,
        accommodation: 0
      };
      itinerary.expenses = [];
    }
  }

  getDateDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  async exportItinerary(itinerary: any) {
    const alert = await this.alertCtrl.create({
      header: 'Export Itinerary',
      subHeader: itinerary.name,
      buttons: [
        {
          text: 'Copy to Notes',
          handler: () => {
            this.exportToNotes(itinerary);
          }
        },
        {
          text: 'Share Link',
          handler: () => {
            this.shareItinerary(itinerary);
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  private exportToNotes(itinerary: any) {
    let notes = `=== ${itinerary.name.toUpperCase()} ===\n\n`;
    
    // Add expense summary
    notes += `💰 EXPENSE SUMMARY\n`;
    notes += `Total Spent: ₱${itinerary.totalExpenses || 0}\n`;
    notes += `Transportation: ₱${itinerary.expenseBreakdown?.transportation || 0}\n`;
    notes += `Food: ₱${itinerary.expenseBreakdown?.food || 0}\n`;
    notes += `Accommodation: ₱${itinerary.expenseBreakdown?.accommodation || 0}\n\n`;
    
    // Add itinerary details
    itinerary.days?.forEach((day: any) => {
      notes += `DAY ${day.day}\n`;
      notes += '='.repeat(20) + '\n';
      
      day.spots?.forEach((spot: any, index: number) => {
        notes += `${index + 1}. ${spot.name}\n`;
        if (spot.timeSlot) notes += `   Time: ${spot.timeSlot}\n`;
        if (spot.duration) notes += `   Duration: ${spot.duration}\n`;
        if (spot.restaurant) notes += `   Restaurant: ${spot.restaurant}\n`;
        if (spot.hotel) notes += `   Hotel: ${spot.hotel}\n`;
        notes += '\n';
      });
      
      notes += '\n';
    });

    // Add detailed expenses
    if (itinerary.expenses && itinerary.expenses.length > 0) {
      notes += `📋 DETAILED EXPENSES\n`;
      notes += '='.repeat(20) + '\n';
      
      itinerary.expenses.forEach((expense: any) => {
        notes += `${expense.category.toUpperCase()}: ₱${expense.amount}\n`;
        notes += `   ${expense.description}\n`;
        notes += `   Date: ${new Date(expense.date).toLocaleDateString()}\n\n`;
      });
    }

    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(notes).then(() => {
        this.showToast('Itinerary copied to clipboard!', 'success');
      }).catch(() => {
        this.showAlert('Export Generated', 'Please manually copy the itinerary.');
      });
    } else {
      this.showAlert('Export Generated', 'Please manually copy the itinerary.');
    }
  }

  private shareItinerary(itinerary: any) {
    // Create a shareable link (simplified version)
    const shareData = {
      title: itinerary.name,
      text: `Check out my completed Cebu itinerary! Total expenses: ₱${itinerary.totalExpenses || 0}`,
      url: window.location.origin + '/shared-itinerary/' + itinerary.id
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {
        this.copyShareLink(shareData.url);
      });
    } else {
      this.copyShareLink(shareData.url);
    }
  }

  private copyShareLink(url: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast('Share link copied to clipboard!', 'success');
      });
    }
  }

  async viewItineraryDetails(itinerary: any) {
    // Create a simpler text-based alert that works better
    let message = `💰 EXPENSES:\n`;
    message += `Total: ₱${itinerary.totalExpenses || 0}\n`;
    message += `🚌 Transportation: ₱${itinerary.expenseBreakdown?.transportation || 0}\n`;
    message += `🍽️ Food: ₱${itinerary.expenseBreakdown?.food || 0}\n`;
    message += `🏨 Accommodation: ₱${itinerary.expenseBreakdown?.accommodation || 0}\n\n`;

    if (itinerary.days && itinerary.days.length > 0) {
      message += `📍 PLACES VISITED:\n`;
      itinerary.days.forEach((day: any, dayIndex: number) => {
        if (itinerary.days.length > 1) {
          message += `Day ${day.day || dayIndex + 1}:\n`;
        }
        
        if (day.spots && day.spots.length > 0) {
          day.spots.forEach((spot: any, spotIndex: number) => {
            const timeInfo = spot.timeSlot ? ` (${spot.timeSlot})` : '';
            message += `${spotIndex + 1}. ${spot.name}${timeInfo}\n`;
            
            if (spot.restaurant && spot.restaurant !== spot.name) {
              message += `   🍽️ ${spot.restaurant}\n`;
            }
            if (spot.hotel && spot.hotel !== spot.name) {
              message += `   🏨 ${spot.hotel}\n`;
            }
          });
        }
        message += `\n`;
      });
    }

    // Add detailed expenses if available
    if (itinerary.expenses && itinerary.expenses.length > 0) {
      message += `📋 EXPENSE DETAILS:\n`;
      
      const expensesByCategory = {
        transportation: itinerary.expenses.filter((e: any) => e.category === 'transportation'),
        food: itinerary.expenses.filter((e: any) => e.category === 'food'),
        accommodation: itinerary.expenses.filter((e: any) => e.category === 'accommodation')
      };

      Object.entries(expensesByCategory).forEach(([category, expenses]: [string, any[]]) => {
        if (expenses.length > 0) {
          const categoryIcon = category === 'transportation' ? '🚌' : category === 'food' ? '🍽️' : '🏨';
          message += `${categoryIcon} ${category.toUpperCase()}:\n`;
          
          expenses.forEach((expense: any) => {
            const date = new Date(expense.date).toLocaleDateString();
            message += `• ₱${expense.amount} - ${expense.description} (${date})\n`;
          });
          message += `\n`;
        }
      });
    }

    const alert = await this.alertCtrl.create({
      header: itinerary.name,
      subHeader: `Completed on ${this.getDateDisplay(itinerary.date)}`,
      message: message,
      buttons: [
        {
          text: 'Export',
          handler: () => {
            this.exportItinerary(itinerary);
          }
        },
        {
          text: 'Close',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  async deleteItinerary(itinerary: any) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Completed Itinerary',
      subHeader: itinerary.name,
      message: 'Are you sure you want to delete this completed itinerary? This will also delete all associated expense records. This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete',
          cssClass: 'danger',
          handler: async () => {
            try {
              await this.performItineraryDeletion(itinerary);
              this.showToast('Itinerary deleted successfully', 'success');
              
              // Refresh the list
              await this.loadCompletedItineraries();
            } catch (error) {
              console.error('Error deleting itinerary:', error);
              this.showToast('Failed to delete itinerary', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  private async performItineraryDeletion(itinerary: any): Promise<void> {
    try {
      // 1. Delete all calendar events for this itinerary
      const allEvents = await this.calendarService.loadAllItineraryEvents();
      const itineraryEvents = allEvents.filter(event => {
        const eventDate = event.start.split('T')[0];
        return eventDate === itinerary.date;
      });

      // Delete each calendar event
      for (const event of itineraryEvents) {
        if (event.id) {
          await this.calendarService.deleteEvent(event.id);
        }
      }

      // 2. Delete all budget expenses for this itinerary
      const allExpenses = await this.budgetService.getCurrentExpenses();
      const itineraryExpenses = allExpenses.filter(expense => 
        expense.itineraryId === itinerary.id ||
        (expense.date && new Date(expense.date).toISOString().split('T')[0] === itinerary.date)
      );

      // Delete each expense
      for (const expense of itineraryExpenses) {
        if (expense.id) {
          await this.budgetService.deleteExpense(expense.id);
        }
      }

    } catch (error) {
      console.error('Error in performItineraryDeletion:', error);
      throw error;
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  goToMyItineraries() {
    this.navCtrl.navigateForward('/my-itineraries');
  }

  goBack() {
    this.navCtrl.back();
  }

  /**
   * Generate what the original itinerary ID would have been before completion
   */
  private generateOriginalItineraryId(itinerary: any): string {
    if (itinerary.days && itinerary.days.length > 0) {
      const spotNames = itinerary.days
        .map((day: any) => day.spots?.map((spot: any) => spot.name) || [])
        .reduce((acc: any[], spots: any[]) => acc.concat(spots), [])
        .join('_');
      return `itinerary_${spotNames.substring(0, 50).replace(/\s+/g, '_')}`;
    }
    return '';
  }
}
