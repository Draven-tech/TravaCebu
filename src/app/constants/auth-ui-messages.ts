/**
 * Formal, user-facing authentication copy (consistent across traveller + admin flows).
 */
export const AuthUiMessages = {
  loginAlertTitle: 'Sign-in unsuccessful',

  traveller: {
    missingFields:
      'Please enter both your email address and password to continue.',
    invalidCredentials:
      'The email address or password entered is incorrect. Please verify your information and try again.',
    profileMissing:
      'No traveller account is associated with these credentials. If you have not yet registered, please create an account first.',
    generic:
      'Sign-in could not be completed at this time. Please try again shortly.',
    network:
      'A network error occurred while contacting the authentication service. Please check your internet connection and try again.',
    rateLimited:
      'Sign-in has been temporarily restricted due to multiple unsuccessful attempts. Please wait briefly and try again.',
    serviceUnavailable:
      'The authentication service is temporarily unavailable. Please try again in a few minutes.',
    invalidEmailFormat: 'Please enter a valid email address.',
  },

  admin: {
    alertTitle: 'Administrator sign-in unsuccessful',
    loading: 'Signing in…',
    insufficientPrivilege:
      'This account is not authorized for administrative access. If you require access, please contact your system administrator.',
    invalidCredentials:
      'The email address or password entered is incorrect. Please verify your administrator credentials and try again.',
    generic:
      'Administrator sign-in could not be completed. Please try again shortly.',
    network:
      'A network error occurred while contacting the authentication service. Please check your internet connection and try again.',
    rateLimited:
      'Sign-in has been temporarily restricted due to multiple unsuccessful attempts. Please wait briefly and try again.',
    serviceUnavailable:
      'The authentication service is temporarily unavailable. Please try again in a few minutes.',
    invalidEmailFormat: 'Please enter a valid email address.',
    weakPassword:
      'The password provided does not meet security requirements. Please choose a stronger password.',
  },

  registration: {
    titleSuccess: 'Registration complete',
    titleValidation: 'Information required',
    titleAgreement: 'Confirmation required',
    titlePassword: 'Password requirements',
    titleError: 'Registration unsuccessful',
    titleProfileError: 'Profile could not be saved',

    missingFields:
      'All required fields must be completed before you can continue.',
    agreementRequired:
      'You must accept the Terms of Service and Privacy Policy to register.',
    passwordMismatch:
      'The passwords entered do not match. Please re-enter them carefully.',
    passwordLength:
      'Your password must be at least six characters in length.',
    success:
      'Your account has been created successfully. You may now sign in.',
    profileSaveFailed:
      'Your account was created, but your profile could not be saved. Please contact support for assistance.',

    emailInUse:
      'An account is already registered with this email address. Please sign in or use a different email.',
    invalidEmail: 'Please enter a valid email address.',
    weakPassword:
      'The password selected does not meet security requirements. Please choose a stronger password.',
    network:
      'A network error occurred during registration. Please check your internet connection and try again.',
    serviceUnavailable:
      'The authentication service is temporarily unavailable. Please try again in a few minutes.',
    generic:
      'Registration could not be completed at this time. Please try again shortly.',
  },
} as const;

/** Internal markers for app-thrown errors (avoid fragile natural-language matching). */
export const AuthErrorCodes = {
  travellerProfileMissing: 'TRAVELLER_PROFILE_MISSING',
  adminAccessDenied: 'ADMIN_ACCESS_DENIED',
  /** Internal: rare post-sign-in UID resolution failure; never shown to users verbatim. */
  uidResolutionFailed: 'UID_RESOLUTION_FAILED',
} as const;
