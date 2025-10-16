import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ItinerarySession {
  id: string;
  selectedItineraryIndex: number;
  selectedItinerary: any;
  currentSegmentIndex: number;
  isActive: boolean;
  startTime: Date;
  lastUpdated: Date;
  progress: {
    completedSegments: number[];
    totalSegments: number;
    percentage: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ItinerarySessionService {
  private currentSessionSubject = new BehaviorSubject<ItinerarySession | null>(null);
  public currentSession$ = this.currentSessionSubject.asObservable();

  private sessionsHistory: ItinerarySession[] = [];

  constructor() {
    // Load any existing session from localStorage
    this.loadSessionFromStorage();
  }

  /**
   * Start a new itinerary session
   */
  startSession(selectedItineraryIndex: number, selectedItinerary: any): ItinerarySession {
    const sessionId = this.generateSessionId();
    const totalSegments = selectedItinerary?.segments?.length || 0;

    const newSession: ItinerarySession = {
      id: sessionId,
      selectedItineraryIndex,
      selectedItinerary,
      currentSegmentIndex: 0,
      isActive: true,
      startTime: new Date(),
      lastUpdated: new Date(),
      progress: {
        completedSegments: [],
        totalSegments,
        percentage: 0
      }
    };

    this.currentSessionSubject.next(newSession);
    this.sessionsHistory.unshift(newSession);
    this.saveSessionToStorage(newSession);

    console.log('🚀 New itinerary session started:', newSession);
    return newSession;
  }

  /**
   * Update current segment in active session
   */
  updateCurrentSegment(segmentIndex: number): void {
    const currentSession = this.currentSessionSubject.value;
    if (!currentSession || !currentSession.isActive) {
      console.warn('No active session to update');
      return;
    }

    const updatedSession = {
      ...currentSession,
      currentSegmentIndex: segmentIndex,
      lastUpdated: new Date()
    };

    this.currentSessionSubject.next(updatedSession);
    this.saveSessionToStorage(updatedSession);

    console.log('📍 Current segment updated:', segmentIndex);
  }

  /**
   * Mark a segment as completed
   */
  markSegmentCompleted(segmentIndex: number): void {
    const currentSession = this.currentSessionSubject.value;
    if (!currentSession || !currentSession.isActive) {
      console.warn('No active session to update');
      return;
    }

    const completedSegments = [...currentSession.progress.completedSegments];
    if (!completedSegments.includes(segmentIndex)) {
      completedSegments.push(segmentIndex);
    }

    const percentage = Math.round((completedSegments.length / currentSession.progress.totalSegments) * 100);

    const updatedSession = {
      ...currentSession,
      progress: {
        ...currentSession.progress,
        completedSegments,
        percentage
      },
      lastUpdated: new Date()
    };

    this.currentSessionSubject.next(updatedSession);
    this.saveSessionToStorage(updatedSession);

    console.log('✅ Segment completed:', segmentIndex, `Progress: ${percentage}%`);
  }

  /**
   * End the current session
   */
  endSession(): void {
    const currentSession = this.currentSessionSubject.value;
    if (currentSession && currentSession.isActive) {
      const endedSession = {
        ...currentSession,
        isActive: false,
        lastUpdated: new Date()
      };

      // Update in history
      const sessionIndex = this.sessionsHistory.findIndex(s => s.id === currentSession.id);
      if (sessionIndex !== -1) {
        this.sessionsHistory[sessionIndex] = endedSession;
      }

      this.currentSessionSubject.next(null);
      this.clearSessionFromStorage();

      console.log('🏁 Session ended:', endedSession);
    }
  }

  /**
   * Get current active session
   */
  getCurrentSession(): ItinerarySession | null {
    return this.currentSessionSubject.value;
  }

  /**
   * Check if there's an active session
   */
  hasActiveSession(): boolean {
    const session = this.currentSessionSubject.value;
    return session !== null && session.isActive;
  }

  /**
   * Get session history
   */
  getSessionsHistory(): ItinerarySession[] {
    return [...this.sessionsHistory];
  }

  /**
   * Resume a previous session
   */
  resumeSession(sessionId: string): boolean {
    const session = this.sessionsHistory.find(s => s.id === sessionId);
    if (session) {
      const resumedSession = {
        ...session,
        isActive: true,
        lastUpdated: new Date()
      };

      this.currentSessionSubject.next(resumedSession);
      this.saveSessionToStorage(resumedSession);

      console.log('🔄 Session resumed:', resumedSession);
      return true;
    }
    return false;
  }

  /**
   * Clear all sessions
   */
  clearAllSessions(): void {
    this.sessionsHistory = [];
    this.currentSessionSubject.next(null);
    this.clearSessionFromStorage();
    console.log('🗑️ All sessions cleared');
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeSession: boolean;
    averageProgress: number;
    totalTimeSpent: number;
  } {
    const totalSessions = this.sessionsHistory.length;
    const activeSession = this.hasActiveSession();
    
    const averageProgress = totalSessions > 0 
      ? this.sessionsHistory.reduce((sum, session) => sum + session.progress.percentage, 0) / totalSessions
      : 0;

    const totalTimeSpent = this.sessionsHistory.reduce((total, session) => {
      const endTime = session.isActive ? new Date() : session.lastUpdated;
      return total + (endTime.getTime() - session.startTime.getTime());
    }, 0);

    return {
      totalSessions,
      activeSession,
      averageProgress: Math.round(averageProgress),
      totalTimeSpent
    };
  }

  // Private helper methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private saveSessionToStorage(session: ItinerarySession): void {
    try {
      localStorage.setItem('current_itinerary_session', JSON.stringify(session));
    } catch (error) {
      console.warn('Failed to save session to localStorage:', error);
    }
  }

  private loadSessionFromStorage(): void {
    try {
      const stored = localStorage.getItem('current_itinerary_session');
      if (stored) {
        const session = JSON.parse(stored);
        // Check if session is still valid (not too old)
        const sessionAge = Date.now() - new Date(session.startTime).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (sessionAge < maxAge && session.isActive) {
          this.currentSessionSubject.next(session);
          console.log('📱 Session loaded from storage:', session);
        } else {
          // Session is too old, clear it
          this.clearSessionFromStorage();
        }
      }
    } catch (error) {
      console.warn('Failed to load session from localStorage:', error);
      this.clearSessionFromStorage();
    }
  }

  private clearSessionFromStorage(): void {
    try {
      localStorage.removeItem('current_itinerary_session');
    } catch (error) {
      console.warn('Failed to clear session from localStorage:', error);
    }
  }
}
