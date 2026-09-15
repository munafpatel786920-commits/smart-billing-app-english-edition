# Security Specification For GST Billing & Inventory Management Application

This specification defines the rigorous security guidelines, verification tests, and malicious payloads designed to test and prove the validity of our Zero-Trust Firestore Security Rule set.

## 1. Data Invariants

Access control and data validation across the collection structure must satisfy these constraints:
1. **Relational Sync**: No sub-collection (e.g. Products, Customers, Invoices, Transactions) may be created or read unless the active user is verified as a registered member of the parent Company with an assigned role (`admin`, `manager`, or `staff`).
2. **Identity Integrity**: User profile fields can only be written by the authenticated user whose `uid` matches the document path. Role elevations are forbidden via client-side operations.
3. **Temporal Integrity**: Fields like `createdAt` must be server-validated using `request.time` on creation and must remain immutable subsequently.
4. **GST Consistency**: State values for SGST, CGST, and IGST fields must match calculated amounts based on rates and locations, validated on write when possible.
5. **No Orphaned Sub-collections**: Writing any item in nested collections (e.g., Invoices or Products) requires checking that the parent Company exists.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads represent targeted attacks attempting to trigger identity spoofing, value poisoning, unauthorized privilege escalation, or orphaned status.

### Payload 1: Profile Identity Spoofing (Attacker writing profile of User B)
- **Target Collection**: `/users/UserB`
- **Caller UID**: `AttackerUser`
- **Intent**: Edit User B's profile info.
- **Result**: `PERMISSION_DENIED`

### Payload 2: Access Privilege Escalation (Self-Assign Admin)
- **Target Collection**: `/companies/CompanyAlpha/members/AttackerUser`
- **Caller UID**: `AttackerUser` (not currently in member collection with admin authority)
- **Payload**: `{ "role": "admin", "userId": "AttackerUser", "companyId": "CompanyAlpha" }`
- **Result**: `PERMISSION_DENIED`

### Payload 3: Shadow Field Injection (Resource Poisoning)
- **Target Collection**: `/companies/CompanyAlpha/products/ProductX`
- **Caller UID**: `StaffUser` (authorized)
- **Payload**: `{ "name": "Standard Wire", "hsnCode": "7408", "purchasePrice": 100, "sellingPrice": 150, "gstRate": 18, "currentStock": 50, "extraGhostField": "maliciousValueToDeleteWalletResource" }`
- **Intent**: Write undocumented/unexpected fields to trigger infinite database costs.
- **Result**: `PERMISSION_DENIED`

### Payload 4: Terminal Invoice Editing (Modifying PAID record)
- **Target Collection**: `/companies/CompanyAlpha/salesInvoices/InvoiceY`
- **Caller UID**: `StaffUser`
- **Payload**: Attempting to reduce grandTotal on an invoice with `paymentStatus: "PAID"`.
- **Result**: `PERMISSION_DENIED`

### Payload 5: Negative Valuation Poisoning (Pricing Sabotage)
- **Target Collection**: `/companies/CompanyAlpha/products/ProductX`
- **Caller UID**: `StaffUser`
- **Payload**: `{ "purchasePrice": -500, "sellingPrice": -200 }`
- **Result**: `PERMISSION_DENIED`

### Payload 6: Impersonating Transaction Origin (Forging Ledgers)
- **Target Collection**: `/companies/CompanyAlpha/transactions/TxA`
- **Caller UID**: `StaffUser`
- **Payload**: `{ "amount": 1000000, "type": "PAYMENT_RECEIVED", "entityId": "CustB", "entityName": "CustB", "date": "2026-06-03T10:16:26Z", "referenceNo": "MaliciousFalsifiedRef", "transactionId": "TxA", "ownerId": "OtherUser" }`
- **Result**: `PERMISSION_DENIED`

### Payload 7: Reading PII without membership (PII Scraping)
- **Target Collection**: `/companies/CompanyAlpha/customers/CustA`
- **Caller UID**: `ExternalUnsignedUser`
- **Intent**: Read complete customer records containing billing addresses, phone numbers, and outstanding values.
- **Result**: `PERMISSION_DENIED`

### Payload 8: Falsifying Invoice Timestamp
- **Target Collection**: `/companies/CompanyAlpha/salesInvoices/InvOne`
- **Caller UID**: `StaffUser`
- **Payload**: `{ "createdAt": "2015-06-03T10:16:26Z", ... }` (manipulated timestamp instead of `request.time`)
- **Result**: `PERMISSION_DENIED`

### Payload 9: Empty IDs and Resource Flooding
- **Target Collection**: `/companies/CompanyAlpha/products/`
- **Caller UID**: `StaffUser`
- **Document ID**: `AVeryLong1MBSpanOfJunkCharactersDesignedToExhaustResourcesAndCrashClientQueries`
- **Result**: `PERMISSION_DENIED`

### Payload 10: State Bypassing (Deleting Audit Ledger)
- **Target Collection**: `/companies/CompanyAlpha/transactions/TxB`
- **Caller UID**: `StaffUser`
- **Operation**: `delete`
- **Result**: `PERMISSION_DENIED` (Audit ledgers can only be manipulated or deleted in strict scenarios / admin only)

### Payload 11: Spoofed Email Domain Claims
- **Target Collection**: `/companies/CompanyAlpha/members/AdminUser`
- **Caller UID**: `SpoofedUser`
- **Unverified Token Email**: `admin@company.com` (auth.token.email_verified == false)
- **Result**: `PERMISSION_DENIED`

### Payload 12: Broad Blank Unconstrained Retrieval
- **Target Collection**: `/companies/CompanyAlpha/salesInvoices`
- **Operation**: Broad `list` query without checking for active Company membership
- **Caller UID**: `ExternalUser`
- **Result**: `PERMISSION_DENIED`

---

## 3. Test Runner

Below is a draft of the unit test architecture using `@firebase/rules-unit-testing`:

```typescript
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'gst-billing-app-4f6c1',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

test('Scenario 1: Reject unauthenticated user reads for PII customers', async () => {
  const aliceDb = testEnv.unauthenticatedContext().firestore();
  await expect(aliceDb.doc('companies/CompA/customers/CustPii').get()).rejects.toThrow();
});

test('Scenario 2: Deny self-escalation role', async () => {
  const badUser = testEnv.authenticatedContext('Attacker').firestore();
  await expect(badUser.doc('companies/CompA/members/Attacker').set({
    role: 'admin',
    userId: 'Attacker',
    companyId: 'CompA'
  })).rejects.toThrow();
});
```
