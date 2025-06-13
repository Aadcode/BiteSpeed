import { PrismaClient } from "./generated/prisma";
const prisma = new PrismaClient();

// Realistic Indian names
const NAMES = [
    { first: 'Rahul', last: 'Sharma' },
    { first: 'Priya', last: 'Patel' },
    { first: 'Amit', last: 'Kumar' },
    { first: 'Sneha', last: 'Singh' },
    { first: 'Rohit', last: 'Gupta' },
    { first: 'Kavya', last: 'Verma' }
];

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com'];
const MOBILE_PREFIXES = ['98', '97', '96', '95', '94', '93'];

const generateEmail = (firstName: string, lastName: string) => {
    const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
};

const generatePhone = () => {
    const prefix = MOBILE_PREFIXES[Math.floor(Math.random() * MOBILE_PREFIXES.length)];
    const remaining = Math.floor(10000000 + Math.random() * 90000000);
    return `+91${prefix}${remaining}`;
};

async function main() {
    console.log('🌱 Seeding contacts as requested...');

    // Clear existing data
    await prisma.contact.deleteMany({});
    console.log('🧹 Cleared existing contacts');

    let contactCount = 0;

    // 1. Create 2 contacts with email and phoneNumber
    console.log('\n📧📱 Creating contacts with email and phoneNumber...');
    for (let i = 0; i < 2; i++) {
        const name = NAMES[i];
        const contact = await prisma.contact.create({
            data: {
                email: generateEmail(name.first, name.last),
                phoneNumber: generatePhone(),
                linkPrecedence: 'primary',
                linkedId: null,
            },
        });
        contactCount++;
        console.log(`   ✅ Created: ${contact.email} | ${contact.phoneNumber}`);
    }

    // 2. Create 2 contacts with only email
    console.log('\n📧 Creating contacts with only email...');
    for (let i = 2; i < 4; i++) {
        const name = NAMES[i];
        const contact = await prisma.contact.create({
            data: {
                email: generateEmail(name.first, name.last),
                phoneNumber: null,
                linkPrecedence: 'primary',
                linkedId: null,
            },
        });
        contactCount++;
        console.log(`   ✅ Created: ${contact.email} | no phone`);
    }

    // 3. Create 2 contacts with only phoneNumber
    console.log('\n📱 Creating contacts with only phoneNumber...');
    for (let i = 4; i < 6; i++) {
        const contact = await prisma.contact.create({
            data: {
                email: null,
                phoneNumber: generatePhone(),
                linkPrecedence: 'primary',
                linkedId: null,
            },
        });
        contactCount++;
        console.log(`   ✅ Created: no email | ${contact.phoneNumber}`);
    }

    console.log(`\n✅ Seeding completed!`);
    console.log(`📊 Total contacts created: ${contactCount}`);

    // Show summary
    const emailAndPhone = await prisma.contact.count({
        where: {
            AND: [
                { email: { not: null } },
                { phoneNumber: { not: null } }
            ]
        }
    });

    const emailOnly = await prisma.contact.count({
        where: {
            AND: [
                { email: { not: null } },
                { phoneNumber: null }
            ]
        }
    });

    const phoneOnly = await prisma.contact.count({
        where: {
            AND: [
                { email: null },
                { phoneNumber: { not: null } }
            ]
        }
    });

    console.log('\n📈 Summary:');
    console.log(`   📧📱 Email + Phone: ${emailAndPhone}`);
    console.log(`   📧   Email only: ${emailOnly}`);
    console.log(`   📱   Phone only: ${phoneOnly}`);
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });