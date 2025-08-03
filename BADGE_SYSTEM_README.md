# Badge System Documentation

## Overview
The badge system has been implemented in the TravaCebu Ionic + Firebase app to reward users for completing various achievements.

## Current Implementation

### 1. Badge Service (`src/app/services/badge.service.ts`)
- **BadgeService**: Manages badge definitions, evaluation, and Firestore operations
- **Badge Interface**: Defines badge structure with title, description, icons, progress, etc.
- **UserBadgeProgress Interface**: Defines user's badge progress structure

### 2. Current Badge: Profile Completion
- **Badge ID**: `profile_complete`
- **Requirements**: 
  - Full name (not empty)
  - Username (not empty)
  - Bio (not empty)
  - Profile picture (not default image)
- **Tiers**: Bronze (unlocked) or Locked
- **Progress**: 0-100% based on completed fields

### 3. Badge Icons
- **Location**: `src/assets/badges/`
- **Files**:
  - `accountComplete.png` - Unlocked badge icon (colorful)
  - `lockedAccountComplete.png` - Locked badge icon (grey)

## Firestore Structure

### User Document Badge Field
```json
{
  "badges": {
    "profile_complete": {
      "tier": "bronze" | "locked",
      "progress": 0-100,
      "unlocked": true | false
    }
  }
}
```

## UI Implementation

### Badge Grid
- **Location**: User Profile Page → Badges Tab
- **Features**:
  - Responsive grid layout
  - Progress bars
  - Locked/unlocked states
  - Tier indicators
  - Hover effects

### Styling
- **File**: `src/app/user-profile/user-profile.page.scss`
- **Features**:
  - Bronze/Silver/Gold tier colors
  - Locked badge grayscale filter
  - Progress bar animations
  - Responsive design

## Security
- Users can only read/write their own badge data
- Badge evaluation happens server-side via Firestore rules
- Profile data validation ensures accurate badge progress

## Extending the System

### Adding New Badges
1. Add badge definition to `BADGE_DEFINITIONS` in BadgeService
2. Create evaluation method in BadgeService
3. Add badge icons to `src/assets/badges/`
4. Update UserBadgeProgress interface
5. Add evaluation call in appropriate service

### Example: Travel Badge
```typescript
// In BadgeService
travel_explorer: {
  id: 'travel_explorer',
  title: 'Travel Explorer',
  description: 'Visit 10 different tourist spots',
  icon: 'assets/badges/travelExplorer.png',
  lockedIcon: 'assets/badges/lockedTravelExplorer.png',
  maxProgress: 10
}
```

## Usage
The badge system automatically evaluates user progress when:
- User profile data changes
- Profile picture is updated
- Profile information is edited

Badges are displayed in the user profile page under the "Badges" tab. 