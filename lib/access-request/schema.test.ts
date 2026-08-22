import { accessRequestSchema, COMPANY_MAX, EMAIL_MAX, NAME_MAX } from "./schema";
import { describe, expect, it } from "vitest";

// The public form is the one endpoint an anonymous visitor can write through, so what it accepts is
// worth pinning down rather than trusting the form to have checked.

const valid = { name: "John Doe", email: "john@example.com", company: "Acme Corp." };

describe("accessRequestSchema", () => {
    it("accepts a complete request", () => {
        expect(accessRequestSchema.parse(valid)).toEqual(valid);
    });

    it("lowercases the email, so a repeat request matches the pending row", () => {
        expect(accessRequestSchema.parse({ ...valid, email: "  John@Example.COM " }).email).toBe("john@example.com");
    });

    it("trims the name and company", () => {
        const parsed = accessRequestSchema.parse({ ...valid, name: "  John Doe  ", company: "  Acme Corp.  " });

        expect(parsed.name).toBe("John Doe");
        expect(parsed.company).toBe("Acme Corp.");
    });

    it("turns an empty company into null rather than an empty string", () => {
        expect(accessRequestSchema.parse({ ...valid, company: "" }).company).toBeNull();
        expect(accessRequestSchema.parse({ ...valid, company: "   " }).company).toBeNull();
        expect(accessRequestSchema.parse({ ...valid, company: null }).company).toBeNull();
    });

    it("rejects a blank name", () => {
        expect(accessRequestSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    });

    it("rejects an invalid email", () => {
        for (const email of ["not-an-email", "john@", "@example.com", ""]) {
            expect(accessRequestSchema.safeParse({ ...valid, email }).success).toBe(false);
        }
    });

    // TEXT columns have no length of their own, so the bound has to be here or not at all.
    it("bounds every field", () => {
        expect(accessRequestSchema.safeParse({ ...valid, name: "a".repeat(NAME_MAX) }).success).toBe(true);
        expect(accessRequestSchema.safeParse({ ...valid, name: "a".repeat(NAME_MAX + 1) }).success).toBe(false);

        expect(accessRequestSchema.safeParse({ ...valid, company: "a".repeat(COMPANY_MAX) }).success).toBe(true);
        expect(accessRequestSchema.safeParse({ ...valid, company: "a".repeat(COMPANY_MAX + 1) }).success).toBe(false);

        const longLocal = "a".repeat(EMAIL_MAX - "@example.com".length);
        expect(accessRequestSchema.safeParse({ ...valid, email: `${longLocal}@example.com` }).success).toBe(true);
        expect(accessRequestSchema.safeParse({ ...valid, email: `${longLocal}a@example.com` }).success).toBe(false);
    });

    it("ignores fields it does not declare, so a hand-rolled POST cannot smuggle extras", () => {
        const parsed = accessRequestSchema.parse({ ...valid, status: "ACCEPTED", id: 1 });

        expect(parsed).toEqual(valid);
    });
});
