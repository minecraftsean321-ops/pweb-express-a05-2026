import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';
import { Currency, Lane, Rarity, Role } from '../src/generated/prisma/enums';

type CsvRow = Record<string, string>;

const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED must be set to seed the database.');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

function parseCSV(filePath: string): CsvRow[] {
  const [headerLine, ...lines] = readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.length > 0);

  if (!headerLine) {
    throw new Error(`CSV file is empty: ${filePath}`);
  }

  const headers = headerLine.split(',').map((header) => header.trim());

  return lines.map((line, index) => {
    const values = line.split(',');
    if (values.length !== headers.length) {
      throw new Error(`Invalid CSV row ${index + 2} in ${filePath}`);
    }

    return Object.fromEntries(
      headers.map((header, valueIndex) => [header, values[valueIndex].trim()]),
    );
  });
}

function parseInteger(value: string, field: string): number {
  if (value === '') return 0; 

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer for ${field}: "${value}"`);
  }
  return parsed;
}

function parseEnum<T extends string>(
  values: readonly T[],
  value: string,
  field: string,
): T {
  const parsed = values.find((candidate) => candidate === value);
  if (!parsed) {
    throw new Error(`Invalid ${field}: "${value}"`);
  }
  return parsed;
}

async function main() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "PlayerHero", "Player", "Skin", "Hero" RESTART IDENTITY CASCADE;`);

  const heroesData = parseCSV(fileURLToPath(new URL('../data/heroes.csv', import.meta.url)));
  const skinsData = parseCSV(fileURLToPath(new URL('../data/skins.csv', import.meta.url)));

  const mappedHeroes = heroesData.map((h) => ({
    name: h.name,
    role: parseEnum(Object.values(Role), h.primaryRole, 'hero role'),
    lane: parseEnum(Object.values(Lane), h.primaryLane, 'hero lane'),
    releaseYear: parseInteger(h.releaseYear, 'hero releaseYear'),
    priceBP: parseInteger(h.priceBP, 'hero priceBP'),
    priceDiamond: parseInteger(h.priceDiamond, 'hero priceDiamond'),
  }));

  const mappedSkins = skinsData.map((s) => ({
    name: s.name,
    heroId: parseInteger(s.heroId, 'skin heroId'),
    rarity: parseEnum(Object.values(Rarity), s.rarity, 'skin rarity'),
    priceDiamond: s.priceDiamond === '' ? 0 : parseInteger(s.priceDiamond, 'skin priceDiamond'),
  }));

  await prisma.hero.createMany({ data: mappedHeroes });
  await prisma.skin.createMany({ data: mappedSkins });

  await prisma.player.createMany({
    data: [
      { nickname: 'ArekITS', bp: 1500, diamond: 75 },
      { nickname: 'SangPushRank', bp: 13000, diamond: 2892 },
      { nickname: 'MageSurabaya', bp: 10000, diamond: 0 },
    ],
  });

  await prisma.playerHero.createMany({
    data: [
      { playerId: 1, heroId: 18, currency: Currency.BP, pricePaid: 2000 },
      { playerId: 1, heroId: 1, currency: Currency.BP, pricePaid: 10800 },
      { playerId: 2, heroId: 84, currency: Currency.DIAMOND, pricePaid: 599 },
      { playerId: 2, heroId: 56, currency: Currency.BP, pricePaid: 32000 },
    ],
  });
  
  console.log('Seeding dari CSV selesai.');
}

main()
  .catch((error: unknown) => {
    console.error('Gagal melakukan seeding:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());