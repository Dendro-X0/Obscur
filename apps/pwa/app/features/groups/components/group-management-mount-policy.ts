/**
 * Group management UI must mount only while open so hook order stays stable
 * and sealed-community side effects do not run in the background on group home.
 */
export function shouldMountGroupManagementDialog(isOpen: boolean): boolean {
    return isOpen;
}
