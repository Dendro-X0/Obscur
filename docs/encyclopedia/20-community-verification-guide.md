# 20 Community System Verification Guide (User-Facing)

_Status: Draft - For user testing and validation_
_Last updated: 2026-05-02_
_Last reviewed: 2026-05-03 (baseline commit 7111e10a)._

## Overview

This guide provides step-by-step instructions for verifying that the community/group persistence system works correctly from a user's perspective. Use these tests to confirm that groups maintain their data (name, members, settings) across sessions and devices.

---

## Test 1: Basic Group Persistence

### Purpose
Verify that a created group retains its name and members after page refresh.

### Steps

1. **Create a Group**
   - Navigate to "Network" → "Groups"
   - Click "Create Group"
   - Enter name: "Persistence Test Group"
   - Add 2-3 members by their public keys
   - Click "Create"

2. **Verify Initial State**
   - Confirm group appears in list as "Persistence Test Group"
   - Open the group
   - Check member list shows all invited members + yourself
   - Take screenshot of group details

3. **Refresh the Page**
   - Press F5 or Cmd+R to refresh
   - Log back in if prompted

4. **Verify After Refresh**
   - Navigate back to "Network" → "Groups"
   - **Expected**: Group still named "Persistence Test Group" (NOT "Private Group")
   - Open the group
   - **Expected**: All members still visible (not just yourself)

### Success Criteria
- [ ] Group name unchanged after refresh
- [ ] All members still present
- [ ] No duplicate groups created

### Failure Indicators
- [ ] Group renamed to "Private Group"
- [ ] Member list shows only creator
- [ ] Multiple copies of same group appear

---

## Test 2: Cross-Device Recovery

### Purpose
Verify that groups created on one device appear correctly on another device.

### Prerequisites
- Two devices (or two browser profiles)
- Same account logged in on both

### Steps

1. **On Device A**
   - Create a group: "Cross-Device Test"
   - Add 2 members
   - Send a test message in the group
   - Wait 30 seconds for sync

2. **On Device B**
   - Log out if already logged in
   - Log in with same account
   - Navigate to "Network" → "Groups"

3. **Verify Recovery**
   - **Expected**: "Cross-Device Test" appears in group list
   - **Expected**: Group name is "Cross-Device Test" (not "Private Group")
   - Open the group
   - **Expected**: All 3 members visible
   - **Expected**: Test message from Device A is visible

### Success Criteria
- [ ] Group appears on Device B
- [ ] Name preserved correctly
- [ ] All members visible
- [ ] Message history intact

### Failure Indicators
- [ ] Group missing from Device B
- [ ] Group appears as "Private Group"
- [ ] Only creator visible in member list
- [ ] No message history

---

## Test 3: Re-Login After Logout

### Purpose
Verify group integrity after explicit logout and re-login.

### Steps

1. **Create Test Setup**
   - Create group: "Re-login Test"
   - Add 2 members
   - Verify group appears correctly

2. **Logout**
   - Go to Settings → Logout
   - Confirm logout

3. **Re-login**
   - Enter credentials
   - Complete login
   - Wait for sync to complete (max 30 seconds)

4. **Verify**
   - Check "Network" → "Groups"
   - **Expected**: "Re-login Test" present with correct name
   - Open group
   - **Expected**: All members present

### Success Criteria
- [ ] Group survives logout/login cycle
- [ ] Name unchanged
- [ ] Members preserved

---

## Test 4: Group Data Health Check (New Feature)

### Purpose
Verify the new data health monitoring feature.

### Steps

1. **Access Group Settings**
   - Open any group
   - Click group name or settings icon
   - Look for "Data Health" section

2. **Review Health Indicators**
   - **Ledger Entry**: Should show ✓ (green)
   - **Member List**: Should show ✓ (green)
   - **Display Name**: Should show ✓ (green)

3. **Check Details**
   - Click on any indicator for details
   - Verify member count matches actual members
   - Verify display name is correct

### Expected UI

```
Data Health
├── Ledger Entry        ✓ Present
├── Member List         ✓ 5 members preserved
└── Display Name        ✓ "Team Project Alpha"
```

### If Issues Found

```
Data Health
├── Ledger Entry        ✓ Present
├── Member List         ⚠ 1 member (expected 5)
└── Display Name        ⚠ "Private Group" (expected "Team Project Alpha")

Issues Found:
- Member list incomplete
- Display name reset to placeholder

[Attempt Repair] [Report Issue]
```

---

## Test 5: Member Addition Persistence

### Purpose
Verify that newly added members persist after refresh.

### Steps

1. **Initial State**
   - Create group with just yourself
   - Note current member count (1)

2. **Add Members**
   - Add Member A by public key
   - Add Member B by public key
   - Verify member count is now 3

3. **Refresh and Verify**
   - Refresh page
   - Re-login if needed
   - Return to group

4. **Expected Result**
   - Member count: 3
   - Member A present
   - Member B present

### Success Criteria
- [ ] New members persist after refresh
- [ ] Member count accurate

### Failure Indicators
- [ ] Added members disappear
- [ ] Count reverts to 1

---

## Test 6: Concurrent Device Usage

### Purpose
Verify groups sync correctly when used on multiple devices simultaneously.

### Steps

1. **Setup**
   - Device A: Create group "Concurrent Test"
   - Device B: Log in to same account
   - Both: Navigate to Groups

2. **Concurrent Actions**
   - Device A: Add Member 1
   - Device B: Add Member 2 (within 10 seconds)
   - Both: Wait 30 seconds
   - Both: Refresh

3. **Verify**
   - Both devices: Check "Concurrent Test" group
   - **Expected**: Both Member 1 and Member 2 present on both devices

### Success Criteria
- [ ] Changes from Device A appear on Device B
- [ ] Changes from Device B appear on Device A
- [ ] No duplicate members
- [ ] No member loss

---

## Regression Test Checklist

### Before Release, Verify All:

- [ ] **Create Group**: New groups appear immediately
- [ ] **Name Persistence**: Custom names survive refresh
- [ ] **Member Persistence**: All members visible after re-login
- [ ] **Avatar Persistence**: Group icons remain
- [ ] **Message History**: Previous messages visible
- [ ] **Cross-Device**: Groups sync to new devices
- [ ] **Offline Support**: Groups visible offline after sync
- [ ] **Backup/Restore**: Groups survive account restore
- [ ] **Health UI**: Data health panel shows correct status
- [ ] **Repair Flow**: Auto-repair fixes missing members

---

## Issue Reporting Template

If you encounter issues, report with:

```
**Test Case**: (e.g., "Test 2: Cross-Device Recovery")

**Steps Taken**:
1. (List what you did)

**Expected Result**:
(What should have happened)

**Actual Result**:
(What actually happened)

**Screenshots**:
(Before/after if possible)

**Device Info**:
- Device type: (Desktop/Mobile)
- Browser/App version:
- Account type: (New/Existing)

**Console Errors** (if on desktop):
(Any red error messages in browser console)

**Data Health Panel** (if accessible):
(Status of each indicator)
```

---

## Quick Diagnostic Commands (Dev Mode)

For developers testing, use these browser console commands:

```javascript
// Check ledger for current user
const ledger = await window.communityDebug.getLedger();
console.table(ledger.map(e => ({
  groupId: e.groupId.substring(0, 8),
  name: e.displayName,
  members: e.memberPubkeys?.length ?? 0,
  version: e.ledgerVersion ?? 'v1 (old)'
})));

// Run integrity check on specific group
await window.communityDebug.checkIntegrity('group-id-here');

// Get repair report
await window.communityDebug.getRepairReport();
```

---

## Success Metrics Summary

After implementing the specification, these metrics should be:

| Metric | Before | Target | Status |
|--------|--------|--------|--------|
| Groups losing members after refresh | >50% | 0% | TBD |
| Groups renamed to "Private Group" | >50% | 0% | TBD |
| Ledger entries with member list | <30% | 100% | TBD |
| User-reported data loss | High | Zero | TBD |

---

**Last Updated**: 2026-05-02  
**Next Review**: After implementation complete
