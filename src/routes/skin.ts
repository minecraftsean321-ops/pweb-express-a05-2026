import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Router, type Request, type Response } from 'express';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { Rarity } from '../generated/prisma/enums';

const router = Router();
const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED must be set to use the skin routes.');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

// 1. Get All Skins (GET /api/skins)
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;
  const heroId = req.query.heroId as string;
  const rarity = req.query.rarity as string;

  const skip = (page - 1) * limit;
  const where: Prisma.SkinWhereInput = {};

  // Filter berdasarkan heroId dan rarity jika parameter diberikan
  if (heroId) where.heroId = parseInt(heroId, 10);
  if (rarity) where.rarity = rarity as Rarity;

  const totalItems = await prisma.skin.count({ where });
  const skins = await prisma.skin.findMany({
    where,
    skip,
    take: limit,
    // Gunakan include untuk menampilkan nama hero sesuai instruksi
    include: {
      hero: {
        select: { name: true }
      }
    }
  });

  const totalPages = Math.ceil(totalItems / limit);

  res.status(200).json({
    status: true,
    message: "Berhasil mengambil data skin",
    data: skins,
    metadata: { currentPage: page, limit, totalItems, totalPages }
  });
});

// 2. Get Skin Detail (GET /api/skins/:skin_id)
router.get('/:skin_id', async (req: Request<{ skin_id: string }>, res: Response) => {
  const skinId = parseInt(req.params.skin_id, 10);

  const skin = await prisma.skin.findUnique({
    where: { id: skinId },
    include: { hero: true } // Memuat detail hero yang berelasi
  });

  if (!skin) {
    return res.status(404).json({ status: false, message: "Skin tidak ditemukan" });
  }

  res.status(200).json({
    status: true,
    message: "Berhasil mengambil detail skin",
    data: skin
  });
});

export default router;
