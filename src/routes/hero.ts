import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Router, type Request, type Response } from 'express';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { Role } from '../generated/prisma/enums';

const router = Router();
const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED must be set to use the hero routes.');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

// 1. Get All Heroes (GET /api/heroes)
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const search = req.query.search as string;
  const role = req.query.role as string;

  const skip = (page - 1) * limit;
  const where: Prisma.HeroWhereInput = {};

  // Filter pencarian nama (case-insensitive) dan role
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (role) where.role = role as Role;

  const totalItems = await prisma.hero.count({ where });
  const heroes = await prisma.hero.findMany({
    where,
    skip,
    take: limit,
  });

  const totalPages = Math.ceil(totalItems / limit);

  res.status(200).json({
    status: true,
    message: "Berhasil mengambil data hero",
    data: heroes,
    metadata: { currentPage: page, limit, totalItems, totalPages }
  });
});

// 2. Get Hero Detail (GET /api/heroes/:hero_id)
router.get('/:hero_id', async (req: Request<{ hero_id: string }>, res: Response) => {
  const heroId = parseInt(req.params.hero_id, 10);

  const hero = await prisma.hero.findUnique({
    where: { id: heroId },
    include: { skins: true } // Mengikutsertakan data skin berelasi
  });

  if (!hero) {
    return res.status(404).json({ status: false, message: "Hero tidak ditemukan" });
  }

  res.status(200).json({
    status: true,
    message: "Berhasil mengambil detail hero",
    data: hero
  });
});

// 3. Create Hero (POST /api/heroes)
router.post('/', async (req: Request, res: Response) => {
  const { name, role, lane, releaseYear, priceBP, priceDiamond } = req.body;

  // Validasi input wajib
  if (!name || !role || !lane || !releaseYear) {
    return res.status(400).json({ status: false, message: "name, role, lane, dan releaseYear wajib diisi" });
  }

  // Pengecekan nama hero duplikat
  const existingHero = await prisma.hero.findUnique({ where: { name } });
  if (existingHero) {
    return res.status(409).json({ status: false, message: "Nama hero sudah ada" });
  }

  // Insert hero baru dengan nilai default 0 untuk price jika tidak diisi
  const newHero = await prisma.hero.create({
    data: {
      name,
      role,
      lane,
      releaseYear: parseInt(releaseYear),
      priceBP: priceBP ? parseInt(priceBP) : 0,
      priceDiamond: priceDiamond ? parseInt(priceDiamond) : 0
    }
  });

  res.status(201).json({
    status: true,
    message: "Berhasil membuat hero baru",
    data: newHero
  });
});

export default router;