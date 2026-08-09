import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SERVICES = [
  "Website Development",
  "Website Design",
  "WordPress Development",
  "E-commerce Website Development",
  "SEO Services",
  "Local SEO",
  "Social Media Marketing",
  "Social Media Management",
  "Digital Marketing",
  "Website Maintenance",
  "Website Redesign",
  "Lead Generation",
];

async function main() {
  // Seed services.
  for (const name of SERVICES) {
    await prisma.service.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  console.log(`Seeded ${SERVICES.length} services.`);

  // Optionally seed an admin user from env.
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      create: { email, name: "Admin", passwordHash, role: "ADMIN" },
      update: {},
    });
    console.log(`Seeded admin user ${email}.`);
  } else {
    console.log(
      "No SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD set — create the first admin via the app's setup screen."
    );
  }

  // Seed a couple of demo clients for first-run testing.
  const demoCount = await prisma.client.count();
  if (demoCount === 0) {
    await prisma.client.createMany({
      data: [
        {
          firstName: "John",
          lastName: "Smith",
          companyName: "Smith Construction",
          phone: "+15551230001",
          email: "john@smithconstruction.com",
          website: "smithconstruction.com",
          industry: "Construction",
          city: "Austin",
          country: "USA",
          leadSource: "Demo",
          servicesNeeded: ["Website Development", "SEO Services"],
        },
        {
          firstName: "Maria",
          lastName: "Lopez",
          companyName: "Lopez Bakery",
          phone: "+15551230002",
          email: "maria@lopezbakery.com",
          industry: "Food & Beverage",
          city: "Miami",
          country: "USA",
          leadSource: "Demo",
          servicesNeeded: ["Social Media Marketing"],
        },
      ],
    });
    console.log("Seeded 2 demo clients.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
