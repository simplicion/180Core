/**
 * 180 Verify — human-readable messages for server error codes.
 * Unknown codes fall back to the server's message (which must never contain raw PII).
 */

export interface HumanError {
  title: string;
  fix: string;
  retryable: boolean;
}

const MAP: Record<string, HumanError> = {
  SESSION_EXPIRED: { title: 'This verification link has expired', fix: 'Go back to the app that sent you here and start verification again.', retryable: false },
  SESSION_NOT_FOUND: { title: 'We could not find this verification session', fix: 'Open the verification link again from the app that sent you here.', retryable: false },
  INVALID_SESSION_TOKEN: { title: 'This verification link is not valid', fix: 'Open the verification link again from the app that sent you here.', retryable: false },
  SESSION_COMPLETED: { title: 'This verification is already finished', fix: 'You can close this window.', retryable: false },
  NETWORK_ERROR: { title: 'Connection problem', fix: 'Check your internet connection and try again.', retryable: true },
  NETWORK_TIMEOUT: { title: 'The server took too long to respond', fix: 'Please try again in a moment.', retryable: true },
  RATE_LIMITED: { title: 'Too many attempts', fix: 'Wait a minute, then try again.', retryable: true },
  PROVIDER_UNAVAILABLE: { title: 'The government / bank registry is not responding', fix: 'This is temporary. Please try again in a few minutes.', retryable: true },
  BIOMETRICS_ENGINE_UNAVAILABLE: { title: 'Face matching is temporarily unavailable', fix: 'Your details are saved. Please try again in a few minutes.', retryable: true },
  CHALLENGE_EXPIRED: { title: 'The face check took too long', fix: 'Start the face check again and complete each prompt promptly.', retryable: true },
  LIVENESS_FAILED: { title: 'We could not confirm a live person', fix: 'Use good, even lighting, remove sunglasses or masks, and follow each prompt on screen.', retryable: true },
  LIVENESS_CHECK_FAILED: { title: 'We could not confirm a live person', fix: 'Use good, even lighting, remove sunglasses or masks, and follow each prompt on screen.', retryable: true },
  SPOOF_DETECTED: { title: 'The face check did not look like a live camera feed', fix: 'Use your own face directly in front of the camera — not a photo, screen or video.', retryable: false },
  FACE_MISMATCH: { title: "Your face did not match your ID photo", fix: 'Make sure you are verifying your own documents and that the card photo was clear and glare-free.', retryable: false },
  FACE_MISMATCH_DETECTED: { title: "Your face did not match your ID photo", fix: 'Make sure you are verifying your own documents and that the card photo was clear and glare-free.', retryable: false },
  NO_FACE_DETECTED: { title: 'No face was found in the selfie', fix: 'Keep your whole face inside the oval in good light.', retryable: true },
  MULTIPLE_FACES: { title: 'More than one face was detected', fix: 'Make sure only you are in front of the camera.', retryable: true },
  NO_DOCUMENT_PHOTO: { title: 'No portrait was found on your ID photo', fix: 'Rescan the FRONT of your card so the printed photo is clearly visible.', retryable: true },
  DOCUMENT_FACE_NOT_FOUND: { title: 'No portrait was found on your ID photo', fix: 'Rescan the FRONT of your card so the printed photo is clearly visible.', retryable: true },
  DOCUMENT_NAME_MISMATCH: { title: 'The name on your documents does not match', fix: 'Enter your name exactly as printed on each document.', retryable: false },
  NAME_MISMATCH: { title: 'The name did not match the registry', fix: 'Enter your name exactly as printed on the document.', retryable: true },
  DOCUMENT_DOB_MISMATCH: { title: 'Date of birth does not match across documents', fix: 'Check the date of birth printed on each document.', retryable: false },
  DOB_MISMATCH: { title: 'Date of birth did not match the registry', fix: 'Enter the date of birth exactly as printed on the document.', retryable: true },
  DOCUMENT_GENDER_MISMATCH: { title: 'Gender does not match across documents', fix: 'Check the gender recorded on each document.', retryable: false },
  DOCUMENT_MISMATCH: { title: 'Your documents do not belong to the same person', fix: 'Use documents that all belong to you.', retryable: false },
  DOCUMENT_NOT_FOUND: { title: 'The document number was not found', fix: 'Check the number for typos and try again.', retryable: true },
  INVALID_DOCUMENT: { title: 'The document number is not valid', fix: 'Check the number for typos and try again.', retryable: true },
  DOCUMENT_INACTIVE: { title: 'This document is not active', fix: 'Use a different, currently valid document.', retryable: false },
  DOCUMENT_EXPIRED: { title: 'This document has expired', fix: 'Use a different, currently valid document.', retryable: false },
  DOCUMENTS_INCOMPLETE: { title: 'Some documents were not verified', fix: 'Complete every requested document before the face check.', retryable: true },
  BANK_NAME_MISMATCH: { title: 'Bank account holder name does not match', fix: 'Use an account that is in your own name.', retryable: true },
  BANK_ACCOUNT_INVALID: { title: 'The bank account could not be verified', fix: 'Check the account number and IFSC, or use UPI instead.', retryable: true },
  INVALID_VPA: { title: 'The UPI ID could not be verified', fix: 'Check the UPI ID, or verify with account number and IFSC instead.', retryable: true },
  CAMERA_UNAVAILABLE: { title: 'The camera is not available', fix: 'Allow camera access, or open this link on a phone with a camera.', retryable: true },
};

export function humanError(code: string | null | undefined, serverMessage?: string | null): HumanError {
  const key = String(code || '').toUpperCase();
  if (MAP[key]) return MAP[key];
  return {
    title: serverMessage && serverMessage.length < 200 ? serverMessage : 'Verification could not be completed',
    fix: 'Please review your details and try again, or contact the app that sent you here.',
    retryable: true,
  };
}
