import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient()

interface IreturnContactObject {
    primaryContactId: string,
    emails: Array<string>,
    phoneNumbers: Array<string>,
    secondaryContactIds: Array<number>
};

const findRootPrimaryId = async (contactId: number): Promise<number> => {
    const contact = await prisma.contact.findUnique({
        where: { id: contactId }
    });

    if (!contact) {
        throw new Error(`Contact with id ${contactId} not found`);
    }

    // If this is already a primary contact, return its ID
    if (contact.linkPrecedence === "primary") {
        return contact.id;
    }

    // If this is a secondary contact, recursively find the root primary
    if (contact.linkedId) {
        return await findRootPrimaryId(contact.linkedId);
    }

    // This shouldn't happen in a well-formed database
    throw new Error(`Secondary contact ${contactId} has no linkedId`);
}

const identify = async (body: { phoneNumber?: string, email?: string }) => {
    const { phoneNumber, email } = body;

    // Validate input - at least one field must be provided
    if (!phoneNumber && !email) {
        throw new Error("Either phoneNumber or email must be provided");
    }

    // Build dynamic where clause to avoid null/undefined matches
    const whereConditions: any[] = [];
    if (phoneNumber) {
        whereConditions.push({ phoneNumber: phoneNumber });
    }
    if (email) {
        whereConditions.push({ email: email });
    }

    const existingContacts = await prisma.contact.findMany({
        where: {
            OR: whereConditions
        }
    });

    // If no existing contacts, create a new primary contact
    if (existingContacts.length === 0) {
        const newContact = await prisma.contact.create({
            data: {
                email: email || null,
                phoneNumber: phoneNumber || null,
                linkPrecedence: "primary"
            }
        });

        return {
            contact: {
                primaryContactId: newContact.id.toString(),
                emails: newContact.email ? [newContact.email] : [],
                phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                secondaryContactIds: []
            }
        };
    }

    console.log("Existing contacts found:", existingContacts);

    // Find all root primary IDs for existing contacts
    const rootPrimaryIds = new Set<number>();
    for (const contact of existingContacts) {
        const rootId = await findRootPrimaryId(contact.id);
        rootPrimaryIds.add(rootId);
    }

    const rootPrimaryIdsArray = Array.from(rootPrimaryIds);

    // If multiple root primaries exist, we need to consolidate them
    if (rootPrimaryIdsArray.length > 1) {
        console.log("Multiple root primaries found, consolidating...");

        // Get all root primary contacts and sort by creation date
        const rootPrimaryContacts = await prisma.contact.findMany({
            where: {
                id: { in: rootPrimaryIdsArray }
            }
        });

        rootPrimaryContacts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const keepPrimary = rootPrimaryContacts[0];
        const convertToSecondary = rootPrimaryContacts.slice(1);

        // Convert other primaries to secondary and update their linked contacts
        for (const contact of convertToSecondary) {
            // Update the contact itself to be secondary
            await prisma.contact.update({
                where: { id: contact.id },
                data: {
                    linkPrecedence: "secondary",
                    linkedId: keepPrimary.id
                }
            });

            // Update all contacts that were linked to this primary
            await prisma.contact.updateMany({
                where: { linkedId: contact.id },
                data: { linkedId: keepPrimary.id }
            });
        }

        // Update rootPrimaryIds to reflect the consolidation
        rootPrimaryIds.clear();
        rootPrimaryIds.add(keepPrimary.id);
    }

    const rootPrimaryId = rootPrimaryIdsArray.length > 1 ? Array.from(rootPrimaryIds)[0] : rootPrimaryIdsArray[0];

    // Check if we need to create a new secondary contact or update existing
    const exactMatch = existingContacts.find(contact =>
        contact.phoneNumber === phoneNumber && contact.email === email
    );

    if (!exactMatch) {
        // Find matches for phone and email separately
        const phoneMatch = phoneNumber ? existingContacts.find(contact => contact.phoneNumber === phoneNumber) : null;
        const emailMatch = email ? existingContacts.find(contact => contact.email === email) : null;

        // Case 1: Phone exists with no email - update it with email
        if (phoneMatch && !phoneMatch.email && email) {
            console.log("Updating existing contact: adding email to phone-only contact");
            await prisma.contact.update({
                where: { id: phoneMatch.id },
                data: { email }
            });
        }
        // Case 2: Email exists with no phone - update it with phone
        else if (emailMatch && !emailMatch.phoneNumber && phoneNumber) {
            console.log("Updating existing contact: adding phone to email-only contact");
            await prisma.contact.update({
                where: { id: emailMatch.id },
                data: { phoneNumber }
            });
        }
        // Case 3: Phone exists with different email - create secondary
        else if (phoneMatch && phoneMatch.email && email && phoneMatch.email !== email) {
            console.log("Creating secondary: phone exists with different email");
            await prisma.contact.create({
                data: {
                    phoneNumber,
                    email,
                    linkPrecedence: "secondary",
                    linkedId: rootPrimaryId
                }
            });
        }
        // Case 4: Email exists with different phone - create secondary
        else if (emailMatch && emailMatch.phoneNumber && phoneNumber && emailMatch.phoneNumber !== phoneNumber) {
            console.log("Creating secondary: email exists with different phone");
            await prisma.contact.create({
                data: {
                    phoneNumber,
                    email,
                    linkPrecedence: "secondary",
                    linkedId: rootPrimaryId
                }
            });
        }
        // Case 5: New combination that doesn't conflict - create secondary
        else if ((phoneMatch || emailMatch) && !phoneMatch?.email && !emailMatch?.phoneNumber) {
            // This case is already handled by Case 1 and Case 2 above
            // No action needed here
        }
        // Case 6: Brand new phone and email combination that links to existing contacts
        else if ((phoneMatch || emailMatch)) {
            console.log("Creating secondary: new combination linking existing contacts");
            await prisma.contact.create({
                data: {
                    phoneNumber: phoneNumber || null,
                    email: email || null,
                    linkPrecedence: "secondary",
                    linkedId: rootPrimaryId
                }
            });
        }
    }

    // Get all contacts related to the root primary ID (refresh after potential updates)
    const allRelatedContacts = await prisma.contact.findMany({
        where: {
            OR: [
                { id: rootPrimaryId },
                { linkedId: rootPrimaryId }
            ]
        }
    });

    // Build the return object
    const returnContactObject: IreturnContactObject = {
        primaryContactId: rootPrimaryId.toString(),
        emails: [],
        phoneNumbers: [],
        secondaryContactIds: []
    };

    // Populate with unique values using Sets for better performance
    const emailSet = new Set<string>();
    const phoneSet = new Set<string>();

    allRelatedContacts.forEach((contact) => {
        if (contact.email) {
            emailSet.add(contact.email);
        }

        if (contact.phoneNumber) {
            phoneSet.add(contact.phoneNumber);
        }

        if (contact.linkPrecedence === "secondary") {
            returnContactObject.secondaryContactIds.push(contact.id);
        }
    });

    returnContactObject.emails = Array.from(emailSet);
    returnContactObject.phoneNumbers = Array.from(phoneSet);

    return {
        contact: returnContactObject
    };
}

export default identify;