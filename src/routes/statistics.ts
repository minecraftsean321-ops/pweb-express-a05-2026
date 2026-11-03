import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Router, type Request, type Response } from "express";
import { PrismaClient } from "../generated/prisma/client";

const router = Router();
const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL_UNPOOLED must be set to use the statistics routes.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

// GET /api/statistics
router.get("/", async (_req: Request, res: Response) => {
  // Jalankan 5 query sekaligus (paralel) biar cepat
  const [totalPlayers, totalHeroesOwned, diamondSum, topOwned, roleGroups] =
    await Promise.all([
      // Jumlah player
      prisma.player.count(),
      // Jumlah baris di tabel PlayerHero
      prisma.playerHero.count(),
      // Total diamond semua player
      prisma.player.aggregate({ _sum: { diamond: true } }),
      // Hero paling banyak dimiliki: kelompokkan per heroId, urutkan jumlah terbesar
      prisma.playerHero.groupBy({
        by: ["heroId"],
        _count: { heroId: true },
        orderBy: [{ _count: { heroId: "desc" } }, { heroId: "asc" }],
        take: 1,
      }),
      // Jumlah hero per role
      prisma.hero.groupBy({
        by: ["role"],
        _count: { role: true },
        orderBy: { role: "asc" },
      }),
    ]);

  // groupBy cuma kasih heroId, jadi ambil nama hero-nya
  let mostOwnedHero = null;
  const top = topOwned[0];
  if (top) {
    const hero = await prisma.hero.findUnique({
      where: { id: top.heroId },
      select: { id: true, name: true },
    });
    mostOwnedHero = {
      heroId: top.heroId,
      name: hero?.name ?? null,
      totalOwners: top._count.heroId,
    };
  }

  return res.status(200).json({
    status: true,
    message: "Berhasil mengambil statistik",
    data: {
      totalPlayers,
      totalHeroesOwned,
      totalDiamond: diamondSum._sum.diamond ?? 0,
      mostOwnedHero,
      heroesPerRole: roleGroups.map((g) => ({
        role: g.role,
        total: g._count.role,
      })),
    },
  });
});

export default router;
