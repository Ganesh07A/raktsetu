import type { BloodGroup } from './constants';

/**
 * Red Blood Cell (RBC) Compatibility Matrix
 * Maps recipient blood group -> list of compatible donor blood groups
 * Ordered by medical preference: identical match first, then compatible alternatives.
 */
export const RBC_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

/**
 * Returns the list of compatible donor groups for a given recipient blood group.
 * If the blood group is invalid, returns an empty array.
 */
export function getCompatibleDonorGroups(
  recipientBloodGroup: BloodGroup | string
): BloodGroup[] {
  return RBC_COMPATIBILITY[recipientBloodGroup as BloodGroup] ?? [];
}

/**
 * Returns true if a donor with `donorBloodGroup` can safely donate red blood cells to `recipientBloodGroup`.
 */
export function isDonorCompatible(
  donorBloodGroup: BloodGroup | string,
  recipientBloodGroup: BloodGroup | string
): boolean {
  const compatibleList = getCompatibleDonorGroups(recipientBloodGroup);
  return compatibleList.includes(donorBloodGroup as BloodGroup);
}

/**
 * Returns which recipient blood groups can safely receive blood from a given donor blood group.
 */
export function getCompatibleRecipientGroups(
  donorBloodGroup: BloodGroup | string
): BloodGroup[] {
  const recipients: BloodGroup[] = [];
  for (const [recipient, donors] of Object.entries(RBC_COMPATIBILITY) as [
    BloodGroup,
    BloodGroup[],
  ][]) {
    if (donors.includes(donorBloodGroup as BloodGroup)) {
      recipients.push(recipient);
    }
  }
  return recipients;
}
