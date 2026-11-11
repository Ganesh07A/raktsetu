import type { BloodGroup, ComponentType } from './constants';

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
 * Whole Blood Compatibility Matrix
 * Whole blood contains both donor RBCs and donor plasma antibodies.
 * Standard hematology guidelines mandate identical ABO group with compatible Rh factor.
 */
export const WHOLE_BLOOD_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-'],
  'A+': ['A+', 'A-'],
  'B-': ['B-'],
  'B+': ['B+', 'B-'],
  'AB-': ['AB-'],
  'AB+': ['AB+', 'AB-'],
};

/**
 * Plasma / Fresh Frozen Plasma (FFP) Compatibility Matrix
 * Plasma contains antibodies, not donor RBCs.
 * AB donor has no anti-A or anti-B antibodies (Universal Plasma Donor).
 * O donor has both anti-A and anti-B antibodies (can only donate plasma to O recipients).
 */
export const PLASMA_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'AB+': ['AB+', 'AB-'],
  'AB-': ['AB-', 'AB+'],
  'A+': ['A+', 'A-', 'AB+', 'AB-'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'B+': ['B+', 'B-', 'AB+', 'AB-'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

/**
 * Platelet Compatibility Matrix
 * Platelets are suspended in donor plasma; ABO-identical is preferred, followed by compatible plasma.
 */
export const PLATELET_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'AB+': ['AB+', 'AB-'],
  'AB-': ['AB-', 'AB+'],
  'A+': ['A+', 'A-', 'AB+', 'AB-'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'B+': ['B+', 'B-', 'AB+', 'AB-'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

/**
 * Helper to select compatibility matrix based on blood component type.
 */
export function getCompatibilityMatrix(
  componentType?: ComponentType | string
): Record<BloodGroup, BloodGroup[]> {
  switch (componentType) {
    case 'whole_blood':
      return WHOLE_BLOOD_COMPATIBILITY;
    case 'ffp':
    case 'plasma':
      return PLASMA_COMPATIBILITY;
    case 'platelets':
      return PLATELET_COMPATIBILITY;
    case 'prbc':
    case 'rbc':
    default:
      return RBC_COMPATIBILITY;
  }
}

/**
 * Returns the list of compatible donor groups for a given recipient blood group and component type.
 * If the blood group is invalid, returns an empty array.
 */
export function getCompatibleDonorGroups(
  recipientBloodGroup: BloodGroup | string,
  componentType?: ComponentType | string
): BloodGroup[] {
  const matrix = getCompatibilityMatrix(componentType);
  return matrix[recipientBloodGroup as BloodGroup] ?? [];
}

/**
 * Returns true if a donor with `donorBloodGroup` can safely donate the specified component to `recipientBloodGroup`.
 */
export function isDonorCompatible(
  donorBloodGroup: BloodGroup | string,
  recipientBloodGroup: BloodGroup | string,
  componentType?: ComponentType | string
): boolean {
  const compatibleList = getCompatibleDonorGroups(recipientBloodGroup, componentType);
  return compatibleList.includes(donorBloodGroup as BloodGroup);
}

/**
 * Returns which recipient blood groups can safely receive blood from a given donor blood group.
 */
export function getCompatibleRecipientGroups(
  donorBloodGroup: BloodGroup | string,
  componentType?: ComponentType | string
): BloodGroup[] {
  const matrix = getCompatibilityMatrix(componentType);
  const recipients: BloodGroup[] = [];
  for (const [recipient, donors] of Object.entries(matrix) as [
    BloodGroup,
    BloodGroup[],
  ][]) {
    if (donors.includes(donorBloodGroup as BloodGroup)) {
      recipients.push(recipient);
    }
  }
  return recipients;
}
