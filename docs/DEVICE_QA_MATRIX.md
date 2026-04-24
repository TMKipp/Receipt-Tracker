# Device QA Matrix

This matrix is the execution checklist for pushing mobile readiness from MVP to 8/10.

## Devices

- iPhone (latest iOS)
- iPhone (previous iOS major)
- Android flagship (latest Android)
- Android mid-tier device

## Core Flows (Must Pass)

1. Onboarding and login
2. Capture from camera
3. Capture from photo library
4. Offline queue in airplane mode
5. Reconnect + auto retry
6. Manual retry from queue health
7. Review, edit, approve
8. QuickBooks sync proof
9. Excel sync proof
10. Billing/paywall visibility
11. App background/resume during upload
12. Reinstall + login + state recovery

## Test Cases

| ID | Flow | Expected Result | Status | Notes |
| --- | --- | --- | --- | --- |
| DQ-01 | Camera capture | Receipt is added with `uploading -> processing -> review_required` | Pending | |
| DQ-02 | Library upload | Upload works and preview fields render | Pending | |
| DQ-03 | Airplane mode capture | Queue state is `queued_offline` with no data loss | Pending | |
| DQ-04 | Reconnect | Queued receipts auto-retry and progress to processing | Pending | |
| DQ-05 | Manual retry | Retry button moves failed/queued records forward | Pending | |
| DQ-06 | Edit and approve | Updates persist and stale sync jobs are invalidated | Pending | |
| DQ-07 | QuickBooks sync | Sync job reaches `succeeded` with request id evidence | Pending | |
| DQ-08 | Excel sync | Sync job reaches `succeeded` with workbook append | Pending | |
| DQ-09 | Restore app session | User can relogin and continue queue/review safely | Pending | |
| DQ-10 | Background/resume | Upload and processing do not corrupt receipt state | Pending | |

## Exit Criteria for 8/10

- At least 95% pass rate across all matrix cases.
- No critical blocker in `DQ-03` through `DQ-08`.
- Failures mapped to actionable bug tickets with reproduction notes.
